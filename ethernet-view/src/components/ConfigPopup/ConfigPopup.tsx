import { useEffect, useState } from "react";
import styles from "./ConfigPopup.module.scss";
import { Button } from "../FormComponents/Button/Button";
import { CheckBox } from "../FormComponents/CheckBox/CheckBox";
import { TextInput } from "../FormComponents/TextInput/TextInput";
import { NumericInput } from "../FormComponents/NumericInput/NumericInput";
import type { ConfigData } from "../../types/ConfigData";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const AVAILABLE_BOARDS = [
  "BCU",
  "BMSL",
  "HVSCU",
  "HVSCU-Cabinet",
  "LCU",
  "PCU",
  "VCU",
  "BLCU",
];

const TIME_UNITS = ["ns", "us", "ms", "s"];

const DEFAULT_CONFIG: ConfigData = {
  vehicle: {
    boards: [
      "BCU",
      "BMSL",
      "HVSCU",
      "HVSCU-Cabinet",
      "LCU",
      "PCU",
      "VCU",
      "BLCU",
    ],
  },
  adj: {
    branch: "main",
  },
  network: {
    manual: false,
  },
  transport: {
    propagate_fault: false,
  },
  tcp: {
    backoff_min_ms: 100,
    backoff_max_ms: 5000,
    backoff_multiplier: 1.5,
    max_retries: 0,
    connection_timeout_ms: 1000,
    keep_alive_ms: 1000,
  },
  blcu: {
    ip: "127.0.0.1",
    download_order_id: 0,
    upload_order_id: 0,
  },
  tftp: {
    block_size: 131072,
    retries: 3,
    timeout_ms: 5000,
    backoff_factor: 2,
    enable_progress: true,
  },
  logger: {
    time_unit: "us",
    logging_path: "",
  },
};

export const ConfigPopup = ({ isOpen, onClose }: Props) => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Combined disabled state for all interactions
  const isDisabled = isLoading || isLoadingConfig || isImporting;

  const handleImport = async () => {
    if (!window.electronAPI) {
      console.warn("Electron API not available");
      return;
    }

    setIsImporting(true);
    try {
      await window.electronAPI.importConfig();
      // Reload config after import
      await loadConfig();
    } catch (error) {
      console.error("Error importing config:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsImporting(false);
    }
  };

  const loadConfig = async () => {
    if (window.electronAPI) {
      setIsLoadingConfig(true);
      try {
        const loadedConfig = await window.electronAPI.getConfig();
        setConfig(loadedConfig);
      } catch (error) {
        console.error("Error loading config:", error);
      } finally {
        setIsLoadingConfig(false);
      }
    } else {
      console.log(
        "Electron API is not available. Using default config constant."
      );
      // No Electron API - use default config immediately
      setConfig(DEFAULT_CONFIG);
    }
  };

  const handleSaveConfig = async (config: ConfigData) => {
    console.log("Saving config:", config);

    if (window.electronAPI) {
      // Call Electron API when available
      await window.electronAPI.saveConfig(config);
    } else {
      // Simulate config save for now
      console.log("Electron API is not available. This is a browser test.");
    }
  };

  // Helper function to safely update config
  const updateConfig = (updater: (prev: ConfigData) => ConfigData) => {
    setConfig((prev) => {
      if (!prev) return null;
      return updater(prev);
    });
  };

  // Load config when popup opens
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    } else {
      // Reset config when popup closes
      setConfig(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!config) return;

    setIsLoading(true);

    try {
      await handleSaveConfig(config);
      onClose();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDisabled) {
      onClose();
    }
  };

  const toggleBoard = (board: string) => {
    if (!config) return;

    updateConfig((prev) => ({
      ...prev,
      vehicle: {
        boards: prev.vehicle.boards.includes(board)
          ? prev.vehicle.boards.filter((b: string) => b !== board)
          : [...prev.vehicle.boards, board],
      },
    }));
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.popup}>
        {isLoading && <div className={styles.loadingOverlay} />}

        <div className={styles.header}>
          <h2 className={styles.title}>Configuration</h2>
          <div className={styles.headerActions}>
            <Button
              label={isImporting ? "Importing..." : "Import"}
              onClick={handleImport}
              disabled={isDisabled}
              className={styles.importButton}
            />
            <button
              className={styles.closeButton}
              onClick={onClose}
              disabled={isDisabled}
            >
              ×
            </button>
          </div>
        </div>

        {isLoadingConfig ? (
          <div className={styles.loadingConfigContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>Loading configuration...</p>
          </div>
        ) : config || config != null ? (
          <div className={styles.content}>
            {/* Vehicle Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Vehicle Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Boards</label>
                <div className={styles.checkboxGroup}>
                  {AVAILABLE_BOARDS.map((board) => (
                    <label key={board} className={styles.checkboxLabel}>
                      <CheckBox
                        isRequired={false}
                        initialValue={config.vehicle.boards.includes(board)}
                        onChange={() => toggleBoard(board)}
                        disabled={isDisabled}
                      />
                      <span>{board}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* ADJ Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>ADJ Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Branch</label>
                <TextInput
                  isValid={true}
                  value={config.adj.branch}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      adj: { ...prev.adj, branch: e.target.value },
                    }))
                  }
                  placeholder="main"
                  disabled={isDisabled}
                />
              </div>
            </section>

            {/* Network Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Network Configuration</h3>
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <CheckBox
                    isRequired={false}
                    initialValue={config.network.manual}
                    onChange={(value) =>
                      updateConfig((prev) => ({
                        ...prev,
                        network: { ...prev.network, manual: value },
                      }))
                    }
                    disabled={isDisabled}
                  />
                  <span>Manual network device selection</span>
                </label>
              </div>
            </section>

            {/* Transport Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Transport Configuration</h3>
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <CheckBox
                    isRequired={false}
                    initialValue={config.transport.propagate_fault}
                    onChange={(value) =>
                      updateConfig((prev) => ({
                        ...prev,
                        transport: {
                          ...prev.transport,
                          propagate_fault: value,
                        },
                      }))
                    }
                    disabled={isDisabled}
                  />
                  <span>Propagate fault</span>
                </label>
              </div>
            </section>

            {/* TCP Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>TCP Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Backoff Min (ms)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.backoff_min_ms}
                  placeholder="100"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: { ...prev.tcp, backoff_min_ms: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Backoff Max (ms)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.backoff_max_ms}
                  placeholder="5000"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: { ...prev.tcp, backoff_max_ms: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Backoff Multiplier</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.backoff_multiplier}
                  placeholder="1.5"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: {
                        ...prev.tcp,
                        backoff_multiplier: Number(value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Max Retries</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.max_retries}
                  placeholder="0"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: { ...prev.tcp, max_retries: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Connection Timeout (ms)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.connection_timeout_ms}
                  placeholder="1000"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: {
                        ...prev.tcp,
                        connection_timeout_ms: Number(value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Keep Alive (ms)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tcp.keep_alive_ms}
                  placeholder="1000"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tcp: { ...prev.tcp, keep_alive_ms: Number(value) || 0 },
                    }))
                  }
                />
              </div>
            </section>

            {/* BLCU Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>BLCU Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>IP Address</label>
                <TextInput
                  isValid={true}
                  value={config.blcu.ip}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      blcu: { ...prev.blcu, ip: e.target.value },
                    }))
                  }
                  placeholder="127.0.0.1"
                  disabled={isDisabled}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Download Order ID</label>
                <NumericInput
                  required={true}
                  defaultValue={config.blcu.download_order_id}
                  placeholder="0"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      blcu: {
                        ...prev.blcu,
                        download_order_id: Number(value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Upload Order ID</label>
                <NumericInput
                  required={true}
                  defaultValue={config.blcu.upload_order_id}
                  placeholder="0"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      blcu: {
                        ...prev.blcu,
                        upload_order_id: Number(value) || 0,
                      },
                    }))
                  }
                />
              </div>
            </section>

            {/* TFTP Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>TFTP Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Block Size (bytes)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tftp.block_size}
                  placeholder="131072"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tftp: { ...prev.tftp, block_size: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Retries</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tftp.retries}
                  placeholder="3"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tftp: { ...prev.tftp, retries: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Timeout (ms)</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tftp.timeout_ms}
                  placeholder="5000"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tftp: { ...prev.tftp, timeout_ms: Number(value) || 0 },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Backoff Factor</label>
                <NumericInput
                  required={true}
                  defaultValue={config.tftp.backoff_factor}
                  placeholder="2"
                  disabled={isDisabled}
                  isValid={true}
                  onChange={(value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      tftp: {
                        ...prev.tftp,
                        backoff_factor: Number(value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <CheckBox
                    isRequired={false}
                    initialValue={config.tftp.enable_progress}
                    onChange={(value) =>
                      updateConfig((prev) => ({
                        ...prev,
                        tftp: { ...prev.tftp, enable_progress: value },
                      }))
                    }
                    disabled={isDisabled}
                  />
                  <span>Enable progress</span>
                </label>
              </div>
            </section>

            {/* Logger Configuration */}
            {/* Logger Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Logger Configuration</h3>
              <div className={styles.field}>
                <label className={styles.label}>Time Unit</label>
                <select
                  className={styles.select}
                  value={config.logger.time_unit}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      logger: { ...prev.logger, time_unit: e.target.value },
                    }))
                  }
                  disabled={isDisabled}
                >
                  {TIME_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Logging Path</label>
                <div className={styles.folderPickerContainer}>
                  <TextInput
                    isValid={true}
                    value={config.logger.logging_path}
                    onChange={(e) =>
                      updateConfig((prev) => ({
                        ...prev,
                        logger: {
                          ...prev.logger,
                          logging_path: e.target.value,
                        },
                      }))
                    }
                    placeholder="Select logging folder..."
                    disabled={isDisabled}
                    className={styles.folderInput}
                  />
                  <Button
                    label="Browse"
                    onClick={async () => {
                      if (window.electronAPI) {
                        try {
                          const folderPath =
                            await window.electronAPI.selectFolder();
                          if (folderPath) {
                            updateConfig((prev) => ({
                              ...prev,
                              logger: {
                                ...prev.logger,
                                logging_path: folderPath,
                              },
                            }));
                          }
                        } catch (error) {
                          console.error("Error selecting folder:", error);
                        }
                      }
                    }}
                    disabled={isDisabled}
                    className={styles.browseButton}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <p>Config not found</p>
        )}

        <div className={styles.footer}>
          <Button
            label="Cancel"
            onClick={onClose}
            color="hsl(212, 15%, 50%)"
            className={styles.cancelButton}
            disabled={isDisabled}
          />
          <Button
            label={isLoading ? "Saving..." : "Save"}
            onClick={handleSave}
            className={styles.saveButton}
            disabled={isDisabled}
          />
        </div>
      </div>
    </div>
  );
};
