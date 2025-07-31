# Software - Control Station

[![CI](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-backend.yaml/badge.svg)](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-backend.yaml)
[![CI](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-ethernet-view.yaml/badge.svg)](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-ethernet-view.yaml)
[![CI](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-control-station.yaml/badge.svg)](https://github.com/HyperloopUPV-H8/software/actions/workflows/build-control-station.yaml)

Hyperloop UPV's Control Station is a unified software solution for real-time monitoring and commanding of the pod. It combines a back-end (Go) that ingests and interprets sensor data–defined via the JSON-based "ADJ" specifications–and a front-end (Typescript/React) that displays metrics, logs, and diagnostics to operators. With features like packet parsing, logging, and live dashboards, it acts as the central hub to safely interface the pod, making it easier for team members to oversee performance, detect faults, and send precise orders to the vehicle.

<img width="1728" height="997" alt="control_station_mock" src="https://github.com/user-attachments/assets/a77b3411-c466-4100-8277-48d957290a46" />

## Quick Start

### For Users

Download the latest release, unzip it and run the executable compatible with your OS.

### For Developers

See our comprehensive [Documentation](./docs/README.md) or jump to [Getting Started](./docs/guides/getting-started.md). Quick start:

```bash
# Clone and setup
git clone https://github.com/HyperloopUPV-H8/software.git
cd software
./scripts/dev.sh setup

# Run services
./scripts/dev.sh backend      # Backend server
./scripts/dev.sh ethernet     # Ethernet view
./scripts/dev.sh control      # Control station
```

## Configuration

When using the Control Station make sure that you have configured your IP as the one specified in the ADJ—usually `192.168.0.9`. Then make sure to configure the boards you'll be making use of in the `config.toml` (at the top of the file you'll be able to see the `vehicle/boards` option, just add or remove the boards as needed following the format specified in the ADJ.

To change the ADJ branch from `main`, change the option `adj/branch` at the end of the `config.toml` with the name of the branch you want to use or leave it blank if you'll be making use of a custom ADJ.

## Documentation

📚 **[Complete Documentation](./docs/README.md)** - All guides and references

### Quick Links
- 🚀 **[Getting Started](./docs/guides/getting-started.md)** - New user guide
- 🛠️ **[Development Setup](./docs/development/DEVELOPMENT.md)** - Developer environment setup  
- 🏗️ **[Architecture](./docs/architecture/README.md)** - System design overview
- 🔧 **[Troubleshooting](./docs/troubleshooting/BLCU_FIX_SUMMARY.md)** - Common issues and fixes

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for ways to contribute to the Control Station.

### About

HyperloopUPV is a student team based at Universitat Politècnica de València (Spain), which works every year to develop the transport of the future, the hyperloop. Check out [our website](https://hyperloopupv.com/#/)
