use actix_cors::Cors;
use actix_web::{middleware, web, HttpServer};
use atomic_lib::Storelike;
use std::sync::Mutex;

use crate::errors::AtomicServerResult;

/// Start the server
pub async fn serve(config: crate::config::Config) -> AtomicServerResult<()> {
    // Setup the database and more
    let appstate = crate::appstate::init(config.clone())?;

    // Start other async processes
    #[cfg(feature = "desktop")]
    crate::tray_icon::tray_icon_process(config.clone());

    if config.opts.rebuild_index {
        let appstate_clone = appstate.clone();

        actix_web::rt::spawn(async move {
            log::warn!("Building value index... This could take a while, expect worse performance until 'Building value index finished'");
            appstate_clone
                .store
                .clear_index()
                .expect("Failed to clear value index");
            appstate_clone
                .store
                .build_index(true)
                .expect("Failed to build value index");
            log::info!("Building value index finished!");
        });
        log::info!("Removing existing search index...");
        appstate_clone
            .search_state
            .writer
            .write()
            .expect("Could not get a lock on search writer")
            .delete_all_documents()?;
        log::info!("Building search index...");
        crate::search::add_all_resources(&appstate_clone.search_state, &appstate.store)?;
        log::info!("Search index finished!");
    }

    let server = HttpServer::new(move || {
        // The appstate can be accessed in Handlers using
        // data: web::Data<Mutex<AppState>>
        // In the argument of a handler function
        let data = web::Data::new(Mutex::new(appstate.clone()));
        // Allow requests from other domains
        // let cors = Cors::default().allow_any_origin();
        let cors = Cors::permissive();

        actix_web::App::new()
            .app_data(data)
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .configure(|app| crate::routes::config_routes(app, &appstate.config))
            .default_service(web::to(|| {
                log::error!("Wrong route, should not happen with normal requests");
                actix_web::HttpResponse::NotFound()
            }))
            .app_data(
                web::JsonConfig::default()
                    // register error_handler for JSON extractors.
                    .error_handler(crate::jsonerrors::json_error_handler),
            )
    });

    let message = format!("{}\n\nVisit {}\n\n", BANNER, config.local_base_url);

    if config.opts.https {
        if cfg!(feature = "https") {
            #[cfg(feature = "https")]
            {
                // If there is no certificate file, or the certs are too old, start HTTPS initialization
                if std::fs::File::open(&config.cert_path).is_err()
                    || crate::https::check_expiration_certs()
                {
                    crate::https::cert_init_server(&config).await?;
                }
                let https_config = crate::https::get_https_config(&config)
                    .expect("HTTPS TLS Configuration with Let's Encrypt failed.");
                let endpoint = format!("{}:{}", config.opts.ip, config.opts.port_https);
                println!("{}", message);
                server
                    .bind_rustls(&endpoint, https_config)
                    .expect(&*format!("Cannot bind to endpoint {}", &endpoint))
                    .run()
                    .await?;
            }
        } else {
            return Err("The HTTPS feature has been disabled for this build. Please compile atomic-server with the HTTP feature. `cargo install atomic-server`".into());
        }
    } else {
        let endpoint = format!("{}:{}", config.opts.ip, config.opts.port);
        println!("{}", message);
        server
            .bind(&format!("{}:{}", config.opts.ip, config.opts.port))
            .expect(&*format!("Cannot bind to endpoint {}", &endpoint))
            .run()
            .await?;
    }
    crate::process::remove_pid(&config)?;

    Ok(())
}

const BANNER: &str = r#"
         __                  _
  ____ _/ /_____  ____ ___  (_)____      ________  ______   _____  _____
 / __ `/ __/ __ \/ __ `__ \/ / ___/_____/ ___/ _ \/ ___/ | / / _ \/ ___/
/ /_/ / /_/ /_/ / / / / / / / /__/_____(__  )  __/ /   | |/ /  __/ /
\__,_/\__/\____/_/ /_/ /_/_/\___/     /____/\___/_/    |___/\___/_/
"#;
