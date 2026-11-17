//! Ejecutable mínimo para demostrar la integración con `software-core`.

use tracing_subscriber::EnvFilter;

fn main() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    tracing::info!("iniciando demo de station");
    let name = std::env::args().nth(1).unwrap_or_else(|| "World".into());
    let _greeting = software_core::hello_world::greet(&name);
    tracing::info!("demo finalizada");
}
