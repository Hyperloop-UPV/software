# station

El backend de la Control Station de Hyperloop UPV: escucha a las placas del
pod, decodifica sus paquetes, los reenvía a los frontends y guarda un
registro en disco. Construido sobre [`software-core`](../core/README.md).

La librería ([`lib.rs`](src/lib.rs)) expone los módulos [HTTP](src/http/README.md)
y [WebSocket](src/websocket/README.md) como `station::http` y
`station::websocket`.

## Ejecutar la demo

```sh
cargo run -p station -- "Hyperloop UPV"
```

El binario ([`main.rs`](src/main.rs)) ejecuta la [demo de saludo](../../readme-demo.md).
El arranque del backend y la carga de la configuración quedan pendientes.

