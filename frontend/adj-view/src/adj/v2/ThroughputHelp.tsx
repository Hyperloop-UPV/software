// "How the numbers are calculated" side panel for the Throughput tab. Every
// figure is derived from the constants the calculation itself uses, so the
// help can't drift from the model.
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components";
import { BookOpen } from "@workspace/ui/icons";
import type { ReactNode } from "react";
import {
  ETH_FCS_BYTES,
  ETH_HEADER_BYTES,
  ETH_INTERFRAME_GAP_BYTES,
  ETH_MIN_PAYLOAD_BYTES,
  ETH_MTU_BYTES,
  ETH_PREAMBLE_SFD_BYTES,
  formatBitrate,
  IPV4_HEADER_BYTES,
  PACKET_ID_BYTES,
  TRANSPORT_HEADER_BYTES,
  wireBreakdown,
  type Transport,
} from "./throughput";

const UDP = TRANSPORT_HEADER_BYTES.UDP;
const TCP = TRANSPORT_HEADER_BYTES.TCP;
const L1 = ETH_PREAMBLE_SFD_BYTES + ETH_INTERFRAME_GAP_BYTES;
const MIN_FRAME = ETH_HEADER_BYTES + ETH_MIN_PAYLOAD_BYTES + ETH_FCS_BYTES;
const MAX_FRAME = ETH_HEADER_BYTES + ETH_MTU_BYTES + ETH_FCS_BYTES;
const noPaddingFrom = (t: Transport) => ETH_MIN_PAYLOAD_BYTES - IPV4_HEADER_BYTES - TRANSPORT_HEADER_BYTES[t];
const maxPayload = (t: Transport) => ETH_MTU_BYTES - IPV4_HEADER_BYTES - TRANSPORT_HEADER_BYTES[t];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="bg-muted/50 rounded-md border px-3 py-2 text-[13px] tabular-nums">{children}</div>;
}

function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-xs tabular-nums">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={i === 0 ? "px-3 py-1.5 text-left font-medium" : "px-3 py-1.5 text-right font-medium"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "px-3 py-1.5" : "px-3 py-1.5 text-right"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThroughputHelp({ backendMs, boardMs }: { backendMs: number; boardMs: number }) {
  // Worked example: one enum sent every 10 ms, like "VCU State".
  const ex = wireBreakdown(PACKET_ID_BYTES + 1, "UDP", true);
  const exHz = 100;
  const ka = wireBreakdown(PACKET_ID_BYTES, "TCP", true);
  const kaRate = (ms: number) => (ms > 0 ? 1000 / ms : 0);
  const kaPerDirection = ka.total * 8 * (kaRate(backendMs) + kaRate(boardMs));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:col-span-2">
          <BookOpen className="size-4" />
          How the numbers are calculated
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[42rem]">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">How the numbers are calculated</SheetTitle>
          <SheetDescription>
            Every figure in this tab follows from the ADJ, the backend&apos;s wire format and the standard sizes of UDP,
            TCP, IPv4 and Ethernet. Nothing is measured on a real network.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 px-6 py-6 text-sm leading-relaxed">
          <Section title="What is counted">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium">UDP data packets:</span>{" "}packets whose socket is one of the board&apos;s UDP
                (DatagramSocket) sockets and that have a period. Orders and packets without a period send nothing on
                their own, so they are left out.
              </li>
              <li>
                <span className="font-medium">TCP keep-alive:</span>{" "}the backend sends an empty packet with ID 1 to every
                connected board, and each board answers with the same packet (backend{" "}
                <code>pkg/transport/keepalive.go</code>).
              </li>
              <li>
                <span className="font-medium">TCP ACKs:</span>{" "}in the worst case every keep-alive is acknowledged by its
                own segment. If the ACK rides on the other side&apos;s keep-alive instead, turn &quot;Separate TCP ACKs&quot;
                off.
              </li>
            </ul>
            <p className="text-muted-foreground">
              &quot;To backend&quot; is board → backend traffic: UDP data, board keep-alives and the ACKs of the backend&apos;s
              keep-alives. &quot;From backend&quot; is the backend&apos;s keep-alives and the ACKs of the boards&apos; ones.
            </p>
          </Section>

          <Section title="1. Payload: what the application sends">
            <p>
              Each UDP datagram carries exactly one packet: a {PACKET_ID_BYTES}-byte packet ID (uint16, little-endian)
              followed by its variables in ADJ order, with no padding between them (backend{" "}
              <code>pkg/transport/packet/data/codec.go</code>).
            </p>
            <Table
              head={["Measurement type", "Bytes"]}
              rows={[
                ["uint8, int8, bool, enum (sent as its uint8 index)", "1"],
                ["uint16, int16", "2"],
                ["uint32, int32, float32", "4"],
                ["uint64, int64, float64", "8"],
              ]}
            />
            <Formula>
              UDP payload = {PACKET_ID_BYTES} B (ID) + Σ variable sizes
              <br />
              Keep-alive payload = {PACKET_ID_BYTES} B (ID only) · Pure ACK payload = 0 B
            </Formula>
          </Section>

          <Section title="2. From payload to bytes on the wire">
            <p>Each layer adds its own header around the payload:</p>
            <Table
              head={["Layer", "Adds"]}
              rows={[
                ["UDP header", `${UDP} B`],
                ["TCP header (no options)", `${TCP} B`],
                ["IPv4 header (no options)", `${IPV4_HEADER_BYTES} B`],
                ["Ethernet header (MACs + EtherType)", `${ETH_HEADER_BYTES} B`],
                ["Ethernet FCS (CRC)", `${ETH_FCS_BYTES} B`],
                ["Preamble + SFD", `${ETH_PREAMBLE_SFD_BYTES} B`],
                ["Inter-frame gap (idle line time)", `${ETH_INTERFRAME_GAP_BYTES} B`],
              ]}
            />
            <Formula>
              IP packet = payload + transport header + {IPV4_HEADER_BYTES} B
              <br />
              Padding = max(0, {ETH_MIN_PAYLOAD_BYTES} B − IP packet)
              <br />
              Ethernet frame = {ETH_HEADER_BYTES} B + IP packet + padding + {ETH_FCS_BYTES} B
              <br />
              On the wire = {ETH_PREAMBLE_SFD_BYTES} B + frame + {ETH_INTERFRAME_GAP_BYTES} B
            </Formula>
            <p className="text-muted-foreground">
              Ethernet can&apos;t send less than {ETH_MIN_PAYLOAD_BYTES} B inside a frame, so short IP packets are padded
              with zeros. Preamble and gap aren&apos;t data, but the link is busy during them, so they count toward
              bandwidth use (turn them off under &quot;Include in the estimate&quot; to count frames only).
            </p>
          </Section>

          <Section title="Minimums and maximums">
            <Table
              head={["", "UDP", "TCP"]}
              rows={[
                ["Headers only (UDP/TCP + IPv4)", `${UDP + IPV4_HEADER_BYTES} B`, `${TCP + IPV4_HEADER_BYTES} B`],
                ["Smallest payload that needs no padding", `${noPaddingFrom("UDP")} B`, `${noPaddingFrom("TCP")} B`],
                ["Smallest Ethernet frame", `${MIN_FRAME} B`, `${MIN_FRAME} B`],
                ["Smallest cost on the wire", `${MIN_FRAME + L1} B`, `${MIN_FRAME + L1} B`],
                [`Largest payload in one frame (MTU ${ETH_MTU_BYTES} B)`, `${maxPayload("UDP")} B`, `${maxPayload("TCP")} B`],
                ["Largest Ethernet frame", `${MAX_FRAME} B`, `${MAX_FRAME} B`],
                ["Largest cost on the wire", `${MAX_FRAME + L1} B`, `${MAX_FRAME + L1} B`],
              ]}
            />
            <p>
              Any UDP packet with up to {noPaddingFrom("UDP")} B of payload (ID + up to {noPaddingFrom("UDP") - PACKET_ID_BYTES}{" "}
              B of variables) costs the same {MIN_FRAME + L1} B on the wire. Sending several tiny packets at the same
              rate costs much more than one packet that merges them.
            </p>
            <p className="text-muted-foreground">
              A keep-alive ({PACKET_ID_BYTES} B) and a pure ACK (0 B) are both below the TCP minimum, so each costs{" "}
              {MIN_FRAME + L1} B on the wire. Packets bigger than {maxPayload("UDP")} B of UDP payload would be split into
              IP fragments; that isn&apos;t modelled.
            </p>
          </Section>

          <Section title="3. Rate and throughput">
            <Formula>
              Rate (Hz) = 1 ÷ period in seconds (period units: ns, us, ms, s)
              <br />
              Throughput (bit/s) = bytes per packet × 8 × rate
              <br />
              Efficiency = payload ÷ bytes on the wire
            </Formula>
            <p>
              Both the payload rate and the on-the-wire rate are shown; the bars and board totals use the on-the-wire
              rate. Units are decimal: 1 kbit/s = 1,000 bit/s, 1 Mbit/s = 1,000,000 bit/s.
            </p>
          </Section>

          <Section title="Worked example: one enum every 10 ms">
            <Table
              head={["Step", "Bytes"]}
              rows={[
                [`Payload: ID ${PACKET_ID_BYTES} B + enum 1 B`, `${ex.payload} B`],
                [`+ UDP ${UDP} B + IPv4 ${IPV4_HEADER_BYTES} B = IP packet`, `${ex.ipPacket} B`],
                [`+ padding up to ${ETH_MIN_PAYLOAD_BYTES} B`, `${ex.padding} B`],
                [`+ Ethernet ${ETH_HEADER_BYTES} B + FCS ${ETH_FCS_BYTES} B = frame`, `${ex.frame} B`],
                [`+ preamble ${ETH_PREAMBLE_SFD_BYTES} B + gap ${ETH_INTERFRAME_GAP_BYTES} B = on the wire`, `${ex.total} B`],
              ]}
            />
            <Formula>
              Rate = 1 ÷ 0.01 s = {exHz} Hz
              <br />
              Payload: {ex.payload} B × 8 × {exHz} Hz = {formatBitrate(ex.payload * 8 * exHz)}
              <br />
              On the wire: {ex.total} B × 8 × {exHz} Hz = {formatBitrate(ex.total * 8 * exHz)} (efficiency{" "}
              {((ex.payload / ex.total) * 100).toFixed(1)}%)
            </Formula>
          </Section>

          <Section title="TCP keep-alive">
            <p>
              The backend sends the keep-alive every <code>tcp.keep_alive_interval_ms</code> (50 ms in{" "}
              <code>cmd/config.toml</code>) to the boards listed in <code>[vehicle] boards</code>; &quot;TCP
              connected&quot; stands in for that list. The connection uses TCP_NODELAY, so each keep-alive is its own
              segment.
            </p>
            <Formula>
              Per connected board and direction = {ka.total} B × 8 × (keep-alives + ACKs per second)
              <br />
              With your intervals ({backendMs} ms / {boardMs} ms) and separate ACKs: {formatBitrate(kaPerDirection)} each
              way
            </Formula>
          </Section>

          <Section title="The capacity bar">
            <p>
              100% of a bar is the link capacity you set. Each board&apos;s segment is its traffic ÷ capacity; the solid
              part is UDP and the striped part is keep-alive. Ethernet is full duplex, so each direction has the whole
              capacity to itself: &quot;Per direction&quot; shows two bars, &quot;Both ways&quot; adds them into one.
            </p>
          </Section>

          <Section title="Assumptions and limits">
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
              <li>IPv4 and TCP without options. TCP timestamps would add 12 B, a VLAN tag 4 B per frame.</li>
              <li>Periods are exact; there is no jitter, loss or retransmission.</li>
              <li>No IP fragmentation: every packet is assumed to fit in one frame.</li>
              <li>Other traffic (ARP, SNTP, TFTP, orders sent by the operator) isn&apos;t included.</li>
              <li>Edited periods only change this estimate, never the ADJ.</li>
            </ul>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
