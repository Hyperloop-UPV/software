use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    default_adj_path: Vec<String>,
}

impl Config {
    pub fn new() -> Result<Config, anyhow::Error> {
        let config_path = &std::fs::read_to_string("config.toml")?;
        let config = toml::from_str::<Config>(config_path)?;
        Ok(config)
    }

    pub fn default_adj_path(&self) -> &Vec<String> {
        &self.default_adj_path
    }

    pub fn construct_default_adj_path(&self) -> PathBuf {
        self.default_adj_path()
            .iter()
            .fold(PathBuf::new(), |acc, part| acc.join(part))
    }
}
