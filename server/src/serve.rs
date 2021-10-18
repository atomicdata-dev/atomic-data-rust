use actix_cors::Cors;
use actix_web::{middleware, web, HttpServer};
use atomic_lib::{errors::AtomicResult, Storelike};
use std::{sync::Mutex};

/// Start the server
pub async fn serve(config: crate::config::Config) -> AtomicResult<()> {
    // Setup the database and more
    let appstate = crate::appstate::init(config.clone())?;

    // Start other async processes
    #[cfg(feature = "desktop")]
    crate::tray_icon::tray_icon_process(config.clone());

    if config.opts.rebuild_index {
        let appstate_clone = appstate.clone();

        actix_web::rt::spawn(async move {
            log::warn!("Building index... This could take a while, expect worse performance until 'Building index finished'");
            appstate_clone
                .store
                .clear_index()
                .expect("Failed to clear index");
            appstate_clone
                .store
                .build_index(true)
                .expect("Failed to build index");
            log::info!("Building index finished!");
        });
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
            .configure(crate::routes::config_routes)
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
        // If there is no certificate file, or the certs are too old, start HTTPS initialization
        if std::fs::File::open(&config.cert_path).is_err() || crate::https::check_expiration_certs()
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
