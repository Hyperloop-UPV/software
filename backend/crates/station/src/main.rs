//! Ejecutable mínimo para demostrar la integración con `software-core`.

use tracing_subscriber::EnvFilter;

fn main() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    tracing::info!("iniciando demo de station");
    let name = std::env::args().nth(1).unwrap_or_else(|| "World".into());
    let _greeting = software_core::hello_world::greet(&name);

    let adj_path =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/src/adj/test/adj");
    let adj = match software_core::adj::load_from_dir(&adj_path) {
        Ok(adj) => adj,
        Err(err) => {
            tracing::error!(%err, "no se pudo cargar el ADJ de prueba");
            std::process::exit(1);
        }
    };
    tracing::info!(boards = adj.pod_data.boards.len(), "adj de prueba cargado");

    tracing::info!("demo finalizada");
}
