# BLCU Programming backend that runs behind flashing view
# - Http server to communication with the frontend
# - TFTP client to upload and download files from the BLCU
# - UDP server to receive BLCU status (ADJ)
# - TCP to send the order to the BLCU (ADJ)
# Vasyl Kilimenko, Lola Castillo & Javier Ribal del Río 11
import os
import uvicorn


def main() -> None:
    # Get env variables for host, port, and log level, with defaults if not set
    host = os.environ.get("BLCU_API_HOST", "127.0.0.1")
    port = int(os.environ.get("BLCU_API_PORT", "8069"))
    log_level = os.environ.get("BLCU_API_LOG_LEVEL", "info")

    # Run the Uvicorn server with the specified host, port, and log level
    uvicorn.run("api.server:app", host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
