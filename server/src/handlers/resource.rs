use crate::{
    appstate::AppState,
    content_types::get_accept,
    content_types::ContentType,
    errors::AtomicServerResult,
    helpers::{get_client_agent, try_extension},
};
use actix_web::{web, HttpResponse};
use atomic_lib::Storelike;
use std::sync::Mutex;

/// Respond to a single resource.
/// The URL should match the Subject of the resource.
pub async fn get_resource(
    path: Option<web::Path<String>>,
    data: web::Data<Mutex<AppState>>,
    req: actix_web::HttpRequest,
) -> AtomicServerResult<HttpResponse> {
    let appstate = data.lock().unwrap();

    let headers = req.headers();
    let mut content_type = get_accept(headers);
    let base_url = &appstate.config.local_base_url;
    // Get the subject from the path, or return the home URL
    let subject = if let Some(subj_end) = path {
        let mut subj_end_string = subj_end.as_str();
        if content_type == ContentType::Html {
            if let Some((ext, path)) = try_extension(subj_end_string) {
                content_type = ext;
                subj_end_string = path;
            }
        }
        // Check extensions and set datatype. Harder than it looks to get right...
        // This might not be the best way of creating the subject. But I can't access the full URL from any actix stuff!
        let querystring = if req.query_string().is_empty() {
            "".to_string()
        } else {
            format!("?{}", req.query_string())
        };
        let subject = format!("{}/{}{}", base_url, subj_end_string, querystring);
        subject
    } else {
        // There is no end string, so It's the root of the URL, the base URL!
        String::from(base_url)
    };

    let store = &appstate.store;

    let for_agent = get_client_agent(headers, &appstate, subject.clone())?;
    let mut builder = HttpResponse::Ok();
    log::info!("get_resource: {} as {}", subject, content_type.to_mime());
    builder.header("Content-Type", content_type.to_mime());
    // This prevents the browser from displaying the JSON response upon re-opening a closed tab
    // https://github.com/joepio/atomic-data-rust/issues/137
    builder.header(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
    );
    let resource = store.get_resource_extended(&subject, false, for_agent.as_deref())?;
    match content_type {
        ContentType::Json => {
            let body = resource.to_json(store)?;
            Ok(builder.body(body))
        }
        ContentType::JsonLd => {
            let body = resource.to_json_ld(store)?;
            Ok(builder.body(body))
        }
        ContentType::JsonAd => {
            let body = resource.to_json_ad()?;
            Ok(builder.body(body))
        }
        ContentType::Html => {
            let body = resource.to_json_ad()?;
            Ok(builder.body(body))
        }
        ContentType::Turtle | ContentType::NTriples => {
            let atoms = resource.to_atoms()?;
            let body = atomic_lib::serialize::atoms_to_ntriples(atoms, store)?;
            Ok(builder.body(body))
        }
    }
}
