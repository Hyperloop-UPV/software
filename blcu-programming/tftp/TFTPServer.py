import os
import select
import socket
import threading
import logging
from errno import EINTR
from .TftpShared import *
from .TftpPacketTypes import *
from .TftpPacketFactory import TftpPacketFactory
from .TftpContexts import TftpContextServer

log = logging.getLogger('tftpy.TftpServer')
# Define the logger for TFTP server
logger = logging.getLogger('tftp_server')
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler('tftp_server_activity.log')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

class TftpServer(TftpSession):
    def __init__(self, tftproot=None, dyn_file_func=None, upload_open=None):
        super().__init__()
        self.listenip = None
        self.listenport = None
        self.sock = None
        self.root = os.path.abspath(tftproot)
        self.dyn_file_func = dyn_file_func
        self.upload_open = upload_open
        self.sessions = {}
        self.is_running = threading.Event()
        self.shutdown_gracefully = False
        self.shutdown_immediately = False

        # Validate the TFTP root directory
        if os.path.exists(self.root):
            if not os.path.isdir(self.root):
                raise TftpException("The tftproot must be a directory.")
            if not os.access(self.root, os.R_OK):
                raise TftpException("The tftproot must be readable.")
            if not os.access(self.root, os.W_OK):
                logger.warning("The tftproot is not writable.")
        else:
            raise TftpException("The tftproot does not exist.")

    def handle_write_request(self, address, filename):
        """
        Handle write requests by saving the file to Django's MEDIA_ROOT.
        """
        filepath = os.path.join(self.root, filename)
        try:
            with open(filepath, 'wb') as file:
                self.write_to_file(file)
            logger.info(f"File written to {filepath}")
        except Exception as e:
            logger.error(f"Error writing file {filepath}: {e}")

    def listen(self, listenip="", listenport=DEF_TFTP_PORT, timeout=SOCK_TIMEOUT, retries=DEF_TIMEOUT_RETRIES):
        """
        Start listening for incoming TFTP requests and handle them.
        """
        tftp_factory = TftpPacketFactory()

        if not listenip:
            listenip = '0.0.0.0'
        logger.info("Server requested on IP %s, port %s" % (listenip, listenport))
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.bind((listenip, listenport))
            _, self.listenport = self.sock.getsockname()
        except socket.error as err:
            logger.error(f"Socket error: {err}")
            raise

        self.is_running.set()

        logger.info("Starting receive loop...")
        while True:
            if self.shutdown_immediately:
                logger.warning("Shutting down immediately. Session count: %d" % len(self.sessions))
                self.sock.close()
                for key in self.sessions:
                    self.sessions[key].end()
                self.sessions = {}
                break

            elif self.shutdown_gracefully:
                if not self.sessions:
                    logger.warning("In graceful shutdown mode and all sessions complete.")
                    self.sock.close()
                    break

            inputlist = [self.sock] + [session.sock for session in self.sessions.values()]
            try:
                readyinput, _, _ = select.select(inputlist, [], [], timeout)
            except select.error as err:
                if err[0] == EINTR:
                    logger.debug("Interrupted syscall, retrying")
                    continue
                else:
                    logger.error(f"Select error: {err}")
                    raise

            deletion_list = []

            for readysock in readyinput:
                if readysock == self.sock:
                    buffer, (raddress, rport) = self.sock.recvfrom(MAX_BLKSIZE)
                    if self.shutdown_gracefully:
                        logger.warning("Discarding data on main port, in graceful shutdown mode")
                        continue

                    key = "%s:%s" % (raddress, rport)
                    if key not in self.sessions:
                        self.sessions[key] = TftpContextServer(raddress, rport, timeout, self.root, self.dyn_file_func, self.upload_open, retries=retries)
                        try:
                            self.sessions[key].start(buffer)
                        except TftpException as err:
                            deletion_list.append(key)
                            logger.error("Fatal exception from session %s: %s" % (key, str(err)))
                    logger.info("Currently handling these sessions:")
                    for session_key, session in self.sessions.items():
                        logger.info("    %s" % session)

                else:
                    for key in self.sessions:
                        if readysock == self.sessions[key].sock:
                            try:
                                self.sessions[key].cycle()
                                if self.sessions[key].state is None:
                                    logger.info("Successful transfer.")
                                    deletion_list.append(key)
                            except TftpException as err:
                                deletion_list.append(key)
                                logger.error("Fatal exception from session %s: %s" % (key, str(err)))
                            break
                    else:
                        logger.error("Can't find the owner for this packet. Discarding.")

            for key in deletion_list:
                if key in self.sessions:
                    self.sessions[key].end()
                    metrics = self.sessions[key].metrics
                    if metrics.duration == 0:
                        logger.info("Duration too short, rate undetermined")
                    else:
                        logger.info("Transferred %d bytes in %.2f seconds" % (metrics.bytes, metrics.duration))
                        logger.info("Average rate: %.2f kbps" % metrics.kbps)
                        logger.info("%.2f bytes in resent data" % metrics.resent_bytes)
                        logger.info("%d duplicate packets" % metrics.dupcount)
                    del self.sessions[key]

        self.is_running.clear()
        logger.debug("Server returning from while loop")
        self.shutdown_gracefully = self.shutdown_immediately = False

    def stop(self, now=False):
        """
        Stop the server gracefully. Do not take any new transfers, but complete the existing ones.
        """
        if now:
            self.shutdown_immediately = True
        else:
            self.shutdown_gracefully = True
