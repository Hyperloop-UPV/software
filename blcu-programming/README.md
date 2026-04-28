# TFTP Server and Client

**TFTP Server and Client** is a comprehensive Python-based application designed to facilitate Trivial File Transfer Protocol (TFTP) operations through a user-friendly graphical interface built with PyQt5. This tool allows users to efficiently manage file transfers to and from TFTP servers, making it an essential resource for network administrators.

## Key Features

### TFTP Server
- **Start/Stop Server:** Easily control the TFTP server with start and stop functionalities.
- **Select IP Address:** Choose the specific IP address for the server to listen on.
- **Change Working Directory:** Modify the current working directory for file transfers with a straightforward interface.
- **View Directory Contents:** Quickly access and view files in the current working directory.
- **Logging:** Track server activity with real-time logging displayed in the application and stored in a log file.
[tftp_server](../TFTP_GUI_Server_Client/screenshot/tftp_server.png)
### TFTP Client
- **Upload Files:** Seamlessly upload files to a TFTP server using a simple interface.
- **Download Files:** Effortlessly download files from a TFTP server with progress monitoring.
- **File Browsing:** Use an integrated file dialog for easy file selection.
- **Status Updates:** Receive real-time status updates during upload and download processes.
[tftp_client](../TFTP_GUI_Server_Client/screenshot/tftp_client.png)
### Monitoring and Alerts
- Monitor TFTP server activities and transfer statuses with immediate feedback on successes or failures.
- Real-time updates ensure that users can track the progress of their operations.

### Error Handling and Prompt Detection
- Implement robust error handling specific to TFTP operations to ensure smooth functionality.
- Dynamic prompt detection allows the application to handle varying device responses effectively.

## Example Configurations

### Setting Up the TFTP Server
1. Launch the application and navigate to the TFTP Server tab.
2. Select an available IP address from the dropdown menu.
3. Specify the desired port number (default is 69).
4. Click **Start Server** to begin listening for incoming TFTP requests.

### Uploading Files
1. Navigate to the TFTP Client tab.
2. Enter the TFTP server IP address.
3. Use the **Browse Upload...** button to select the file you wish to upload.
4. Click **Upload File** and monitor the status for updates.

### Downloading Files
1. Enter the TFTP server IP address and specify the file name for download.
2. Click **Download File** to initiate the download process.
3. Progress and status will be displayed in real time.

## System Requirements

To run the TFTP Server and Client application, the following system requirements must be met:

- **Python 3.x**
- **PyQt5**
- **TFTP Library** 
- **OS:** Windows 10 or Ubuntu >=20.04 (recommended) or any modern Linux distribution 

## Technologies Used

- **Python:** The core language utilized for backend logic.
- **PyQt5:** The framework used for developing the graphical user interface.
- **TFTP Library:** Employed for implementing TFTP protocol functionalities.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your enhancements. Alternatively, you can open an issue to suggest improvements or report bugs.

## Author

**petrunetworking** (Network Engineer)

## Acknowledgements

Developed using Python and inspired by the need for efficient file transfer solutions, this application aims to simplify TFTP operations for network professionals, enabling them to manage their file transfers effectively and reliably.
