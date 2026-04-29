import sys
import os
import threading
import socket
import logging
from PyQt5 import QtWidgets, QtGui, QtCore
from tftp.TFTPServer import TftpPacketDAT, TftpPacketERR, TftpServer
from tftp.TftpClient import TftpClient
# Logging Configuration
logger = logging.getLogger('tftp_server')
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler('tftp_server_activity.log')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

import socket

import psutil

def get_ip_addresses():
    """Get the list of available IP addresses on the local machine across all interfaces."""
    ip_addresses = []

    for interface, addresses in psutil.net_if_addrs().items():
        for address in addresses:
            if address.family == socket.AF_INET:  # IPv4 addresses only
                ip_addresses.append(address.address)
    
    # Remove duplicates and return the list of IP addresses
    return list(set(ip_addresses))

class TFTPClient(QtWidgets.QWidget):
    log_signal = QtCore.pyqtSignal(str)  # Signal to update log

    def __init__(self):
        super().__init__()
        self.setWindowTitle("TFTP Client")
        self.setGeometry(500, 100, 500, 400)

        self.hardcoded_ip = "192.168.0.27"

        self.ip_input = QtWidgets.QLineEdit(self)
        self.ip_input.setPlaceholderText("Enter Server IP Address")
        self.ip_input.setText(self.hardcoded_ip)  # Set hardcoded IP
        self.ip_input.setReadOnly(True)

        # Separate inputs for upload and download
        self.upload_file_input = QtWidgets.QLineEdit(self)
        self.upload_file_input.setPlaceholderText("Select File to Upload")
        
        self.download_file_input = QtWidgets.QLineEdit(self)
        self.download_file_input.setPlaceholderText("Enter File Name to Download")

        self.browse_button = QtWidgets.QPushButton("Browse Upload...", self)
        self.browse_button.clicked.connect(self.browse_upload_file)

        self.download_button = QtWidgets.QPushButton("Download File", self)
        self.download_button.clicked.connect(self.download_file)

        self.upload_button = QtWidgets.QPushButton("Upload File", self)
        self.upload_button.clicked.connect(self.upload_file)

        self.use_folder_checkbox = QtWidgets.QCheckBox("Use selected folder for download", self)
        self.use_folder_checkbox.setChecked(False)  # Default unchecked

        self.default_directory_label = QtWidgets.QLabel(self)
        self.default_directory_label.setText(f"Default Download Directory: {self.get_default_directory()}")

        self.status_label = QtWidgets.QLabel("Status: Waiting", self)
        self.status_label.setStyleSheet("font-weight: bold;")

        self.log_output = QtWidgets.QTextEdit(self)
        self.log_output.setReadOnly(True)

        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(QtWidgets.QLabel("Enter Server IP Address:"))
        layout.addWidget(self.ip_input)

        # Upload file section
        layout.addWidget(QtWidgets.QLabel("File to Upload:"))
        layout.addWidget(self.upload_file_input)
        layout.addWidget(self.browse_button)

        # Download file section
        layout.addWidget(QtWidgets.QLabel("File to Download:"))
        layout.addWidget(self.download_file_input)
        layout.addWidget(self.use_folder_checkbox)  # Add the checkbox here

        # Add the default directory label
        layout.addWidget(self.default_directory_label)

        button_layout = QtWidgets.QHBoxLayout()
        button_layout.addWidget(self.download_button)
        button_layout.addWidget(self.upload_button)
        button_layout.addWidget(self.status_label)
        layout.addLayout(button_layout)

        layout.addWidget(QtWidgets.QLabel("Client Log:"))
        layout.addWidget(self.log_output)

        self.setLayout(layout)
        self.setStyleSheet("background-color: #f0f0f0; font-family: Arial;")

        self.total_size = 0
        self.downloaded_size = 0

        # Connect the log signal to the update_log method
        self.log_signal.connect(self.update_log)

    def get_default_directory(self):
        """Return the default download directory."""
        return os.path.expanduser("~")  # User's home directory

    def browse_upload_file(self):
        options = QtWidgets.QFileDialog.Options()
        file_name, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Select File to Upload", "", "All Files (*);;Text Files (*.txt)", options=options)
        if file_name:
            self.upload_file_input.setText(file_name)  # Save the full path for the selected file

    def download_file(self):
        ip = self.ip_input.text()  # Get the manually entered IP address
        filename = self.download_file_input.text()

        if self.use_folder_checkbox.isChecked():
            # Open a dialog to select the folder for saving the downloaded file
            folder = QtWidgets.QFileDialog.getExistingDirectory(self, "Select Folder to Save Downloaded File")
            
            if folder:  # Proceed only if a folder was selected
                self.status_label.setText("Status: Downloading...")
                self.log_output.clear()  # Clear previous logs

                # Construct the full path for the downloaded file
                full_path = os.path.join(folder, filename)

                # Start a new thread for downloading to avoid blocking the UI
                threading.Thread(target=self.perform_download, args=(ip, full_path), daemon=True).start()
            else:
                self.log_signal.emit("Download canceled: No folder selected.")
        else:
            # Default save path (you can modify this to your preferred default directory)
            default_directory = self.get_default_directory()
            full_path = os.path.join(default_directory, filename)

            self.status_label.setText("Status: Downloading...")
            self.log_output.clear()  # Clear previous logs

            # Start a new thread for downloading to avoid blocking the UI
            threading.Thread(target=self.perform_download, args=(ip, full_path), daemon=True).start()

    def perform_download(self, ip, full_path):
        try:
            client = TftpClient(ip, 69)

            # Get total file size
            self.total_size = client.get_file_size(os.path.basename(full_path))
            if self.total_size <= 0:
                self.status_label.setText("Error: Invalid file size.")
                self.log_signal.emit("Error: Invalid file size.")
                return

            # Function to update progress
            def update_progress(packet):
                if isinstance(packet, TftpPacketERR):
                    self.log_signal.emit(f"Error: {packet.errmsg.decode()}")
                    return
                
                # Check for DAT packets (data packets)
                if isinstance(packet, TftpPacketDAT):
                    self.downloaded_size += len(packet.data)
                    self.log_signal.emit(f"Downloaded: {self.downloaded_size} bytes")

            # Start downloading with the update_progress callback
            client.download(os.path.basename(full_path), output=full_path, packethook=update_progress)

            self.status_label.setText("Status: Download Complete")
            self.log_signal.emit("Download complete.")
        except Exception as e:
            self.status_label.setText(f"Error: {str(e)}")
            self.log_signal.emit(f"Error: {str(e)}")

    def upload_file(self):
        ip = self.ip_input.text()  # Get the manually entered IP address
        filename = self.upload_file_input.text()
        self.status_label.setText("Status: Uploading...")
        self.log_output.clear()  # Clear previous logs

        # Start a new thread for uploading to avoid blocking the UI
        threading.Thread(target=self.perform_upload, args=(ip, filename), daemon=True).start()

    def perform_upload(self, ip, filename):
        try:
            client = TftpClient(ip, 69)

            # Get total file size
            self.total_size = os.path.getsize(filename)
            self.downloaded_size = 0  # Reset downloaded size

            # Function to update progress
            def update_progress(packet):
                if isinstance(packet, TftpPacketERR):
                    self.log_signal.emit(f"Error: {packet.errmsg.decode()}")
                    return
                
                # Check for DAT packets (data packets)
                if isinstance(packet, TftpPacketDAT):
                    self.downloaded_size += len(packet.data)
                    self.log_signal.emit(f"Uploaded: {self.downloaded_size} bytes")

            # Start uploading with the update_progress callback
            with open(filename, 'rb') as f:
                client.upload(os.path.basename(filename), input=f, packethook=update_progress)

            self.status_label.setText("Status: Upload Complete")
            self.log_signal.emit("Upload complete.")
        except Exception as e:
            self.status_label.setText(f"Error: {str(e)}")
            self.log_signal.emit(f"Error: {str(e)}")

    def update_log(self, message):
        self.log_output.append(message)
        self.log_output.moveCursor(QtGui.QTextCursor.End)  # Scroll to the bottom


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    client = TFTPClient()
    client.setWindowTitle("TFTP Client by petrunetworking")
    client.setGeometry(100, 100, 500, 400)
    client.setStyleSheet("background-color: #eaeaea; font-family: Arial;")
    client.show()
    sys.exit(app.exec_())
