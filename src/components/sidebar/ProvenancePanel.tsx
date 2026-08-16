import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { tauri } from "../../services/tauri";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";

const INPUT_CLASS =
  "w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none";

export function ProvenancePanel() {
  const c2pa = useVeraMarkStore((state) => state.c2pa);
  const mode = useVeraMarkStore((state) => state.mode);
  const singleImagePath = useVeraMarkStore((state) => state.singleImagePath);

  async function browse(key: "signerKeyPath" | "signerCertPath") {
    const extensions =
      key === "signerKeyPath" ? ["pem", "key"] : ["pem", "crt", "cer"];
    const path = await open({
      multiple: false,
      filters: [{ name: "PEM files", extensions }],
      title:
        key === "signerKeyPath" ? "Select private key" : "Select certificate",
    });
    if (typeof path === "string") {
      useVeraMarkStore.getState().setC2pa({ [key]: path });
    }
  }

  async function verifyManifest() {
    const store = useVeraMarkStore.getState();
    if (!singleImagePath) {
      store.setLastError("Open an image before verifying a manifest.");
      return;
    }
    try {
      const manifest = await tauri.readManifest(singleImagePath);
      if (!manifest) {
        store.setLastMessage("No C2PA manifest found in the selected image.");
      } else {
        store.setLastMessage(
          `Manifest “${manifest.title ?? "(untitled)"}” — ` +
            `generator: ${manifest.claimGenerator ?? "unknown"}, ` +
            `signature: ${
              manifest.signatureValid === null
                ? "n/a"
                : manifest.signatureValid
                  ? "valid"
                  : "invalid"
            }.`,
        );
      }
      store.setLastError(null);
    } catch (error) {
      store.setLastError(String(error));
    }
  }

  return (
    <div className="space-y-3">
      <Toggle
        label="Embed C2PA manifest"
        checked={c2pa.enabled}
        onChange={(enabled) => useVeraMarkStore.getState().setC2pa({ enabled })}
      />
      {c2pa.enabled && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Claim generator</span>
            <input
              className={INPUT_CLASS}
              value={c2pa.claimGeneratorName}
              placeholder="e.g. Acme AI Studio"
              onChange={(e) =>
                useVeraMarkStore
                  .getState()
                  .setC2pa({ claimGeneratorName: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Generator version</span>
            <input
              className={INPUT_CLASS}
              value={c2pa.claimGeneratorVersion}
              placeholder="0.1.0"
              onChange={(e) =>
                useVeraMarkStore
                  .getState()
                  .setC2pa({ claimGeneratorVersion: e.target.value })
              }
            />
          </label>
          <Toggle
            label="Model trained on my data"
            checked={c2pa.producerTrainedOnData}
            onChange={(producerTrainedOnData) =>
              useVeraMarkStore.getState().setC2pa({ producerTrainedOnData })
            }
          />
          <PathPicker
            label="Signing key (PEM)"
            valuePath={c2pa.signerKeyPath}
            onBrowse={() => void browse("signerKeyPath")}
          />
          <PathPicker
            label="Signing certificate (PEM)"
            valuePath={c2pa.signerCertPath}
            onBrowse={() => void browse("signerCertPath")}
          />
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Signing keys are used only to create the C2PA claim signature.
            Manifests are never exported without a signature — generate a key
            pair with <code className="text-zinc-400">openssl req</code> if
            you are testing.
          </p>
        </div>
      )}
      {mode === "single" && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => void verifyManifest()}
        >
          Verify manifest in open image…
        </Button>
      )}
    </div>
  );
}

function PathPicker({
  label,
  valuePath,
  onBrowse,
}: {
  label: string;
  valuePath: string;
  onBrowse: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" className="shrink-0" onClick={onBrowse}>
        Browse
      </Button>
      <div className="min-w-0 flex-1">
        <span className="mb-0.5 block text-xs text-zinc-400">{label}</span>
        <span
          className="block truncate font-mono text-xs text-zinc-300"
          title={valuePath || label}
        >
          {valuePath || "Not set"}
        </span>
      </div>
    </div>
  );
}