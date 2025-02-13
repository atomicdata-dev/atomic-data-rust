use crate::{print::print_resource, Context, SerializeOptions};
use atomic_lib::{agents::ForAgent, errors::AtomicResult, serialize, storelike, Atom, Storelike};

/// Resolves an Atomic Path query
pub fn get_path(
    context: &mut Context,
    path_vec: &Vec<String>,
    serialize: &SerializeOptions,
) -> AtomicResult<()> {
    // let subcommand_matches = context.matches.subcommand_matches("get").unwrap();
    let path_string: String = path_vec.join(" ");

    context.read_config();

    // Returns a URL or Value
    let store = &mut context.store;
    let path = store.get_path(
        &path_string,
        Some(&context.mapping.lock().unwrap()),
        &store.get_default_agent()?.into(),
    )?;
    let out = match path {
        storelike::PathReturn::Subject(subject) => {
            let resource = store.get_resource_extended(&subject, false, &ForAgent::Sudo)?;
            print_resource(context, &resource, serialize)?;
            return Ok(());
        }
        storelike::PathReturn::Atom(atom) => match serialize {
            SerializeOptions::NTriples => {
                let atoms: Vec<Atom> = vec![*atom];
                serialize::atoms_to_ntriples(atoms, store)?
            }
            _other => atom.value.to_string(),
        },
    };
    println!("{}", out);
    Ok(())
}
