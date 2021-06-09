use atomic_lib::{agents::generate_public_key, mapping::Mapping};
use atomic_lib::{agents::Agent, config::Config};
use atomic_lib::{errors::AtomicResult, Storelike};
use clap::{crate_version, App, AppSettings, Arg, ArgMatches, SubCommand};
use colored::*;
use dirs::home_dir;
use path::SERIALIZE_OPTIONS;
use std::{cell::RefCell, path::PathBuf, sync::Mutex};

mod commit;
mod new;
mod path;

#[allow(dead_code)]
/// The Context contains all the data for executing a single CLI command, such as the passed arguments and the in memory store.
pub struct Context<'a> {
    store: atomic_lib::Store,
    mapping: Mutex<Mapping>,
    matches: ArgMatches<'a>,
    config_folder: PathBuf,
    user_mapping_path: PathBuf,
    /// A set of configuration options that are required for writing data on some server
    write: RefCell<Option<Config>>,
}

impl Context<'_> {
    /// Sets an agent
    pub fn get_write_context(&self) -> Config {
        if let Some(write_ctx) = self.write.borrow().as_ref() {
            return write_ctx.clone();
        };
        let write_ctx = set_agent_config().expect("Issue while generating write context / agent configuration");
        self.write.borrow_mut().replace(write_ctx.clone());
        self.store.set_default_agent(Agent {
            subject: write_ctx.agent.clone(),
            private_key: Some(write_ctx.private_key.clone()),
            created_at: atomic_lib::datetime_helpers::now(),
            name: format!("Temporary name for {}", write_ctx.agent),
            public_key: generate_public_key(&write_ctx.private_key).public,
        });
        write_ctx
    }
}

/// Reads config files for writing data, or promps the user if they don't yet exist
fn set_agent_config() -> AtomicResult<Config> {
    let agent_config_path = atomic_lib::config::default_config_file_path()?;
    match atomic_lib::config::read_config(&agent_config_path) {
        Ok(found) => Ok(found),
        Err(_e) => {
            println!("No config found. Let's create one!");
            let server = promptly::prompt("What's the base url of your Atomic Server?")?;
            let agent = promptly::prompt("What's the URL of your Agent?")?;
            let private_key = promptly::prompt("What's the private key of this Agent?")?;
            let config = atomic_lib::config::Config {
                server,
                private_key,
                agent,
            };
            atomic_lib::config::write_config(&agent_config_path, config.clone())?;
            println!(
                "New config file created at {:?}",
                agent_config_path.to_str()
            );
            Ok(config)
        }
    }
}

fn main() -> AtomicResult<()> {
    let matches = App::new("atomic-cli")
        .version(crate_version!())
        .author("Joep Meindertsma <joep@ontola.io>")
        .about("Create, share, fetch and model Atomic Data!")
        .after_help("Visit https://atomicdata.dev for more info")
        .setting(AppSettings::ArgRequiredElseHelp)
        .subcommand(
            SubCommand::with_name("new").about("Create a Resource")
            .arg(
                Arg::with_name("class")
                    .help("The URL or shortname of the Class that should be created")
                    .required(true),
            )
        )
        .subcommand(
            SubCommand::with_name("get")
                    .about("Get a Resource or Value by using Atomic Paths.",
                    )
                    .after_help("\
                    Traverses a Path and prints the resulting Resource or Value. \n\n\
                    Examples: \n\n\
                    $ atomic get class https://atomicdata.dev/properties/description\n\
                    $ atomic get class description\n\
                    $ atomic get https://example.com \n\n\
                    Visit https://docs.atomicdata.dev/core/paths.html for more info about paths. \
                    ")
                .arg(Arg::with_name("path")
                    .help("\
                    The subject URL, shortname or path to be fetched. \
                    Use quotes for paths. \
                    You can use Bookmarks instead of a full subject URL. \
                    ",
                    )
                    .required(true)
                    .min_values(1)
                )
                .arg(Arg::with_name("as")
                    .long("as")
                    .possible_values(&SERIALIZE_OPTIONS)
                    .default_value("pretty")
                    .help(&"Serialization format")
                    .takes_value(true)
                )
        )
        .subcommand(
            SubCommand::with_name("tpf")
                    .about("Finds Atoms using Triple Pattern Fragments.",
                    )
                    .after_help("\
                    Filter the store by <subject> <property> and <value>. \
                    Use a dot to indicate that you don't need to filter. \
                    Subjects and properties need to be full URLs. \
                    ")
                .arg(Arg::with_name("subject")
                    .help("The subject URL or bookmark to be filtered by. Use a dot '.' to indicate 'any'.")
                    .required(true)
                )
                .arg(Arg::with_name("property")
                    .help("The property URL or bookmark to be filtered by. Use a dot '.' to indicate 'any'.")
                    .required(true)
                )
                .arg(Arg::with_name("value")
                    .help("The value URL or bookmark to be filtered by. Use a dot '.' to indicate 'any'.")
                    .required(true)
                )
        )
        .subcommand(
            SubCommand::with_name("set")
                .about("Update a single Atom. Creates both the Resource if they don't exist. Overwrites existing.")
                .arg(Arg::with_name("subject")
                    .help("Subject URL or bookmark of the resource")
                    .required(true)
                )
                .arg(Arg::with_name("property")
                    .help("Property URL or shortname of the property")
                    .required(true)
                )
                .arg(Arg::with_name("value")
                    .help("String representation of the Value to be changed")
                    .required(true)
                )
        )
        .subcommand(
            SubCommand::with_name("remove")
                .about("Remove a single Atom from a Resource.")
                .arg(Arg::with_name("subject")
                    .help("Subject URL or bookmark of the resource")
                    .required(true)
                )
                .arg(Arg::with_name("property")
                    .help("Property URL or shortname of the property to be deleted")
                    .required(true)
                )
        )
        .subcommand(
            SubCommand::with_name("edit")
                .about("Edit a single Atom from a Resource using your text editor.")
                .arg(Arg::with_name("subject")
                    .help("Subject URL or bookmark of the resource")
                    .required(true)
                )
                .arg(Arg::with_name("property")
                    .help("Property URL or shortname of the property to be edited")
                    .required(true)
                )
        )
        .subcommand(
            SubCommand::with_name("destroy")
                .about("Permanently removes a Resource.")
                .arg(Arg::with_name("subject")
                    .help("Subject URL or bookmark of the resource to be destroyed")
                    .required(true)
                )
        )
        .subcommand(SubCommand::with_name("list").about("List all bookmarks"))
        .subcommand(SubCommand::with_name("validate").about("Validates the store").setting(AppSettings::Hidden))
        .get_matches();

    let config_folder = home_dir()
        .expect("Home dir could not be opened. We need this to store some configuration files.")
        .join(".config/atomic/");

    // The mapping holds shortnames and URLs for quick CLI usage
    let mut mapping: Mapping = Mapping::init();
    let user_mapping_path = config_folder.join("mapping.amp");
    if !user_mapping_path.exists() {
        mapping.populate()?;
    } else {
        mapping.read_mapping_from_file(&user_mapping_path)?;
    }

    // Initialize an in-memory store
    let store = atomic_lib::Store::init()?;
    // Add some default data / common properties to speed things up
    store.populate()?;

    let mut context = Context {
        mapping: Mutex::new(mapping),
        store,
        matches,
        config_folder,
        user_mapping_path,
        write: RefCell::new(None),
    };

    match exec_command(&mut context) {
        Ok(r) => {r}
        Err(e) => {
            eprint!("{}", e);
            std::process::exit(1);
        }
    };

    Ok(())
}

fn exec_command(context: &mut Context) -> AtomicResult<()> {
    match context.matches.subcommand_name() {
        Some("destroy") => {
            commit::destroy(context)?;
        }
        Some("edit") => {
            #[cfg(feature = "native")] {
                commit::edit(context)?;
            }
            #[cfg(not(feature = "native"))] {
                return Err("Feature not available. Compile with `native` feature.".into())
            }
        }
        Some("get") => {
            path::get_path(context)?;
        }
        Some("list") => {
            list(context);
        }
        Some("new") => {
            new::new(context)?;
        }
        Some("remove") => {
            commit::remove(context)?;
        }
        Some("set") => {
            commit::set(context)?;
        }
        Some("tpf") => {
            tpf(context)?;
        }
        Some("validate") => {
            validate(context)?;
        }
        Some(cmd) => return Err(format!("{} is not a valid command. Run atomic --help", cmd).into()),
        None => println!("Run atomic --help for available commands"),
    };
    Ok(())
}

/// List all bookmarks
fn list(context: &mut Context) {
    let mut string = String::new();
    for (shortname, url) in context.mapping.lock().unwrap().clone().into_iter() {
        string.push_str(&*format!(
            "{0: <15}{1: <10} \n",
            shortname.blue().bold(),
            url
        ));
    }
    println!("{}", string)
}

/// Returns a resource for the terminal with readble formatting and colors
fn pretty_print_resource(url: &str, store: &impl Storelike) -> AtomicResult<String> {
    let mut output = String::new();
    let resource = store.get_resource(url)?;
    for (prop_url, val) in resource.get_propvals() {
        let prop_shortname = store.get_property(&prop_url)?.shortname;
        output.push_str(&*format!(
            "{0: <15}{1: <10} \n",
            prop_shortname.blue().bold(),
            val.to_string()
        ));
    }
    output.push_str(&*format!("{0: <15}{1: <10} \n", "subject".blue().bold(), url));
    Ok(output)
}

/// Triple Pattern Fragment Query
fn tpf(context: &mut Context) -> AtomicResult<()> {
    let subcommand_matches = context.matches.subcommand_matches("tpf").unwrap();
    let subject = tpf_value(subcommand_matches.value_of("subject").unwrap());
    let property = tpf_value(subcommand_matches.value_of("property").unwrap());
    let value = tpf_value(subcommand_matches.value_of("value").unwrap());
    let endpoint = format!("{}/tpf", &context.get_write_context().server);
    let atoms = atomic_lib::client::fetch_tpf(&endpoint, subject, property, value)?;
    let serialized = atomic_lib::serialize::serialize_atoms_to_ad3(atoms)?;
    println!("{}", serialized);
    Ok(())
}

/// Converts dots to 'None'
fn tpf_value(string: &str) -> Option<&str> {
    if string == "." {
        None
    } else {
        Some(string)
    }
}

/// Validates the store
fn validate(context: &mut Context) -> AtomicResult<()> {
    let reportstring = context.store.validate().to_string();
    println!("{}", reportstring);
    Ok(())
}

#[cfg(test)]
mod test {
    use assert_cmd::Command;

    #[test]
    fn get_fail() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","random-non-existent-shortname"]).assert().failure();
    }

    #[test]
    fn get_shortname() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","shortname"]).assert().success();
    }

    #[test]
    fn get_url() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","https://atomicdata.dev/collections/class"]).assert().success();
    }

    #[test]
    fn get_path() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","https://atomicdata.dev/collections/class members"]).assert().success();
    }

    #[test]
    fn get_path_array() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","https://atomicdata.dev/collections/class is-a 0"]).assert().success();
    }

    #[test]
    fn get_path_array_non_existent() {
        let mut cmd = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd.args(&["get","https://atomicdata.dev/collections/class is-a 1"]).assert().failure();
    }

    #[ignore]
    #[test]
    fn set_and_get() {
        use std::time::SystemTime;
        let value: String = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().to_string();
        let mut cmd_set = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        cmd_set.args(&["set","https://atomicdata.dev/test",atomic_lib::urls::SHORTNAME,&value]).assert().success();

        let mut cmd_get = Command::cargo_bin(env!("CARGO_PKG_NAME")).unwrap();
        let result = cmd_get.args(&["get","https://atomicdata.dev/test shortname"]).assert().success().to_string();
        assert!(result.contains(&value));
    }
}
