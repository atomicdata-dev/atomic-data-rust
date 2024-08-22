use atomic_lib::{agents::ForAgent, atomic_url::Routes, Storelike};
use atomic_server_lib::config::Opts;
use std::{fs::File, io::Write};

mod actor_messages;
mod appstate;
mod commit_monitor;
pub mod config;
mod content_types;
mod errors;
mod handlers;
mod helpers;
#[cfg(feature = "https")]
mod https;
mod jsonerrors;
mod routes;
pub mod serve;
// #[cfg(feature = "search")]
mod search;
#[cfg(test)]
mod tests;
mod trace;

#[actix_web::main]
async fn main() -> () {
    if let Err(e) = main_wrapped().await {
        use colored::Colorize;
        eprintln!("{}: {}", "Error".red(), e.message);
        std::process::exit(1);
    }
    std::process::exit(0);
}

async fn main_wrapped() -> errors::AtomicServerResult<()> {
    // Parse CLI commands, env vars
    let config = config::build_config(config::read_opts())
        .map_err(|e| format!("Initialization failed: {}", e))?;

    match &config.opts.command {
        Some(config::Command::Export(e)) => {
            let path = match e.path.clone() {
                Some(p) => std::path::Path::new(&p).to_path_buf(),
                None => {
                    let date = chrono::Local::now().to_rfc3339();
                    let pathstr = format!("backups/{}.json", date);
                    let mut pt = config.config_dir.clone();
                    pt.push(&pathstr);
                    pt
                }
            };
            let appstate = appstate::AppState::init(config.clone()).await?;
            let outstr = appstate.store.export(!e.only_internal)?;
            std::fs::create_dir_all(path.parent().unwrap())
                .map_err(|e| format!("Failed to create directory {:?}. {}", path, e))?;
            let mut file = File::create(&path)
                .map_err(|e| format!("Failed to write file to {:?}. {}", path, e))?;
            write!(file, "{}", outstr)?;
            println!("Succesfully exported data to {}", path.to_str().unwrap());
            Ok(())
        }
        Some(config::Command::Import(import_opts)) => {
            let readstring = {
                let path = std::path::Path::new(&import_opts.file);
                std::fs::read_to_string(path)?
            };

            let appstate = appstate::AppState::init(config.clone()).await?;
            let importer_subject = if let Some(i) = &import_opts.parent {
                i.into()
            } else {
                appstate
                    .store
                    .get_self_url()
                    .expect("No self URL")
                    .set_route(Routes::Import)
                    .to_string()
            };
            let parse_opts = atomic_lib::parse::ParseOpts {
                importer: Some(importer_subject),
                for_agent: ForAgent::Sudo,
                overwrite_outside: true,
                save: if import_opts.force {
                    atomic_lib::parse::SaveOpts::Save
                } else {
                    atomic_lib::parse::SaveOpts::Commit
                },
                signer: Some(appstate.store.get_default_agent()?),
            };
            println!("Importing...");
            appstate.store.import(&readstring, &parse_opts)?;
            appstate.search_state.add_all_resources(&appstate.store)?;
            println!("Successfully imported {:?} to store.", import_opts.file);
            println!("WARNING: Your search index is not yet updated with these imported items. Run `--rebuild-index` to fix that.");
            Ok(())
        }
        Some(config::Command::ShowConfig) => {
            println!("{:#?}", config);
            Ok(())
        }
        Some(config::Command::Reset) => {
            if dialoguer::Confirm::with_theme(&dialoguer::theme::ColorfulTheme::default())
            .with_prompt(
                format!("Warning!! Do you really want to remove all data from your atomic-server? This will delete {:?}", &config.store_path),
            )
            .interact()
            .unwrap()
            {
                std::fs::remove_dir_all(config.store_path).map(|e| format!("unable to remove directory: {:?}", e))?;
                std::fs::remove_dir_all(config.search_index_path).map(|e| format!("unable to remove directory: {:?}", e))?;
                println!("Done");
            } else {
                println!("Ok, not removing anything.");
            }
            Ok(())
        }
        Some(config::Command::CreateDotEnv) => {
            let current_path = std::env::current_dir()?;
            let pathstr = format!(
                "{}/.env",
                current_path.to_str().expect("Cannot render path")
            );
            if std::path::Path::new(&pathstr).exists() {
                tracing::error!(".env already exists at {}", pathstr);
                panic!("{} already exists", pathstr);
            }
            let mut file = File::create(&pathstr)
                .map_err(|e| format!("Failed to write file to {:?}. {}", current_path, e))?;

            use clap::CommandFactory;
            let command = Opts::command();

            let mut out = String::from("# Generated by `atomic-server generate-dotenv`. \n\n");
            for arg in command.get_arguments() {
                if let Some(env) = arg.get_env() {
                    let Some(hint) = arg.get_help() else {
                        continue;
                    };
                    out.push_str(&format!("# {}\n", hint));
                    let possible_vals = arg.get_possible_values();
                    if !possible_vals.is_empty() {
                        out.push_str(&format!(
                            "# Possible values: {:?}\n",
                            possible_vals
                                .iter()
                                .map(|v| v.get_name())
                                .collect::<Vec<&str>>()
                        ));
                    }
                    let default = arg
                        .get_default_values()
                        .first()
                        .map(|v| v.to_str().expect("Can't convert default value to str"));
                    out.push_str(&format!(
                        "# {}={}\n\n",
                        env.to_str().expect("Can't convert env to string"),
                        default.unwrap_or("")
                    ));
                }
            }
            file.write_all(out.as_bytes())?;

            println!("Successfully created {}", pathstr);
            Ok(())
        }
        None => serve::serve(config).await,
    }
}
