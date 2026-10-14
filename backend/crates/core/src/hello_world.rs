//! Demo de una API documentada con eventos y contexto de `tracing`.
//!
//! El ejecutable configura el subscriber; este módulo solo emite eventos.

/// Construye un saludo para `name`, eliminando espacios exteriores.
///
/// Si el nombre está vacío o solo contiene espacios, saluda a `World`.
/// Emite detalles a nivel `debug` y el saludo a nivel `info`, dentro de un
/// span que identifica al destinatario.
///
/// # Ejemplo
///
/// ```
/// use software_core::hello_world::greet;
///
/// assert_eq!(greet("Hyperloop"), "Hello, Hyperloop!");
/// assert_eq!(greet(""), "Hello, World!");
/// ```
#[tracing::instrument(name = "hello_world", skip(name), fields(recipient = %name))]
pub fn greet(name: &str) -> String {
    let trimmed = name.trim();
    let recipient = if trimmed.is_empty() { "World" } else { trimmed };

    tracing::debug!(used_default = trimmed.is_empty(), "destinatario preparado");
    let greeting = format!("Hello, {recipient}!");
    tracing::info!(greeting = %greeting, "saludo generado");
    greeting
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greets_named_recipient() {
        assert_eq!(greet("Hyperloop"), "Hello, Hyperloop!");
    }

    #[test]
    fn trims_whitespace_and_preserves_unicode() {
        assert_eq!(greet("  Lucía 🚄 \n"), "Hello, Lucía 🚄!");
    }

    #[test]
    fn defaults_to_world_for_empty_or_whitespace_names() {
        for name in ["", " \t\n"] {
            assert_eq!(greet(name), "Hello, World!");
        }
    }
}
