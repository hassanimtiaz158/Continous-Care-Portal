import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, FlaskConical, ScanLine } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Department,
  ImagingOrder,
  IntakeClassification,
  LabOrder,
  OrderStatus,
  OwnershipState,
  Pathway,
  acknowledgeCriticalValue,
  confirmDraftResult,
  fetchImagingOrders,
  fetchLabOrders,
  fetchOwnership,
  updateImagingStatus,
} from "../../lib/cardioApi";

interface CardiologyBoardProps {
  intake: IntakeClassification;
  /** The signed-in physician's display name — required to acknowledge a
   * critical value or authorize an ownership transfer. In a full build
   * this comes from the auth session; exposed as a prop here so the
   * board stays testable without wiring auth into this component. */
  physicianName: string;
}

const PATHWAY_LABEL: Record<Pathway, string> = {
  A: "ER Admission",
  B: "Referral-in",
  C: "Concurrent Care",
  D: "Outbound Consult",
};

const DEPARTMENT_LABEL: Record<Department, string> = {
  cardiology: "Cardiology",
  cardiothoracic_surgery: "CT Surgery",
  radiology: "Radiology",
  neurology: "Neurology",
  nephrology: "Nephrology",
  family_medicine: "Family Medicine",
  emergency: "Emergency",
};

const URGENCY_STYLE: Record<string, string> = {
  stat: "bg-rose/20 text-rose border-rose/50",
  urgent: "bg-gold/20 text-gold border-gold/50",
  routine: "bg-teal/20 text-teal border-teal/50",
};

const ALL_PATHWAYS: Pathway[] = ["A", "B", "C", "D"];

/**
 * A four-ring astrolabe: each concentric ring represents one intake
 * pathway (A/B/C/D). A ring lights up gold when that pathway is active
 * for this case — a case like aortic dissection (A+C+D) lights three of
 * the four rings at once, making the multi-pathway nature visible at a
 * glance rather than buried in a table.
 */
function PathwayAstrolabe({ pathways }: { pathways: Pathway[] }) {
  const size = 132;
  const center = size / 2;
  const radii: Record<Pathway, number> = { A: 58, B: 46, C: 34, D: 22 };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {/* faint fixed guide ticks, astrolabe-style */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const x1 = center + Math.cos(angle) * 62;
          const y1 = center + Math.sin(angle) * 62;
          const x2 = center + Math.cos(angle) * 66;
          const y2 = center + Math.sin(angle) * 66;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--line)"
              strokeWidth={1}
            />
          );
        })}
        {ALL_PATHWAYS.map((p) => {
          const active = pathways.includes(p);
          return (
            <motion.circle
              key={p}
              cx={center}
              cy={center}
              r={radii[p]}
              fill="none"
              stroke={active ? "var(--gold)" : "var(--line)"}
              strokeWidth={active ? 2.5 : 1}
              strokeDasharray={active ? undefined : "2 4"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * radii[p] }}
            />
          );
        })}
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <span className="font-serif text-2xl text-cream">{pathways.join("")}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted">pathway</span>
      </div>
    </div>
  );
}

function StatusRibbon({ status }: { status: string }) {
  const stage = ["ordered", "collected", "resulting", "resulted"];
  const idx = stage.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {stage.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 w-5 rounded-full ${
            i <= idx ? "bg-gold" : "bg-void-3 border border-line"
          }`}
          title={s}
        />
      ))}
    </div>
  );
}

function LabRow({
  order,
  caseId,
  physicianName,
  onAcknowledged,
  onDraftConfirmed,
}: {
  order: LabOrder;
  caseId: string;
  physicianName: string;
  onAcknowledged: (updated: LabOrder) => void;
  onDraftConfirmed: (updated: LabOrder) => void;
}) {
  const [acking, setAcking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const needsSignoff = order.critical && !order.acknowledged_by;

  async function handleAcknowledge() {
    if (!physicianName.trim()) return;
    setAcking(true);
    try {
      const updated = await acknowledgeCriticalValue(caseId, order.id, physicianName);
      onAcknowledged(updated);
    } finally {
      setAcking(false);
    }
  }

  async function handleConfirmDraft() {
    setConfirming(true);
    try {
      const updated = await confirmDraftResult(caseId, order.id);
      onDraftConfirmed(updated);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border px-3 py-2 ${
        needsSignoff ? "border-rose/60 bg-rose/10" : "border-line bg-void-3"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-cream">{order.label}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
            {order.value !== null ? `${order.value}` : "pending"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {order.is_draft && (
            <Badge variant="outline" className="border-gold-dim text-gold">
              DRAFT
            </Badge>
          )}
          {order.critical && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> critical
            </Badge>
          )}
          <StatusRibbon status={order.status} />
        </div>
      </div>
      {order.is_draft && (
        <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-1.5">
          <span className="text-[10px] text-gold">
            OCR-derived — physician confirmation required
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 border-gold-dim px-2 text-[10px] text-gold"
            disabled={confirming}
            onClick={handleConfirmDraft}
          >
            {confirming ? "Confirming…" : "Confirm Result"}
          </Button>
        </div>
      )}
      {order.critical && (
        <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-1.5">
          {order.acknowledged_by ? (
            <span className="text-[10px] text-teal">
              Acknowledged by {order.acknowledged_by}
            </span>
          ) : (
            <>
              <span className="text-[10px] text-rose">Awaiting physician sign-off</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 border-rose/60 px-2 text-[10px] text-rose"
                disabled={acking || !physicianName.trim()}
                onClick={handleAcknowledge}
              >
                {acking ? "Signing…" : "Acknowledge"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const IMAGING_NEXT_STATUS: Record<string, OrderStatus> = {
  ordered: "collected",
  collected: "resulting",
  resulting: "resulted",
};

function ImagingRow({
  order,
  caseId,
  onUpdated,
}: {
  order: ImagingOrder;
  caseId: string;
  onUpdated: (updated: ImagingOrder) => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const next = IMAGING_NEXT_STATUS[order.status];

  async function handleAdvance() {
    if (!next) return;
    setAdvancing(true);
    try {
      const updated = await updateImagingStatus(caseId, order.id, next);
      onUpdated(updated);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-void-3 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-xs text-cream">{order.label}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
          {order.result_summary || "awaiting result"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={URGENCY_STYLE[order.urgency] || ""}>
          {order.urgency}
        </Badge>
        <StatusRibbon status={order.status} />
        {next && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 border-gold-dim px-2 text-[10px] text-gold"
            disabled={advancing}
            onClick={handleAdvance}
          >
            {advancing ? "…" : `→ ${next}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function OwnershipTimeline({ ownership }: { ownership: OwnershipState }) {
  return (
    <div className="flex flex-col gap-0">
      {ownership.history.map((event, i) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                i === ownership.history.length - 1 ? "bg-gold" : "bg-void-3 border border-gold-dim"
              }`}
            />
            {i < ownership.history.length - 1 && (
              <div className="w-px flex-1 bg-line" style={{ minHeight: 20 }} />
            )}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-1.5 text-xs text-cream">
              {event.from_department && (
                <>
                  <span>{DEPARTMENT_LABEL[event.from_department]}</span>
                  <ArrowRight className="h-3 w-3 text-muted" />
                </>
              )}
              <span className="font-semibold text-gold">
                {DEPARTMENT_LABEL[event.to_department]}
              </span>
            </div>
            <p className="text-[11px] text-muted">{event.reason}</p>
            {event.confirmed_by && (
              <p className="text-[10px] text-teal">confirmed by {event.confirmed_by}</p>
            )}
          </div>
        </div>
      ))}
      {ownership.consulting_departments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {ownership.consulting_departments.map((d) => (
            <Badge key={d} variant="secondary">
              consulting: {DEPARTMENT_LABEL[d]}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function CardiologyBoard({ intake, physicianName }: CardiologyBoardProps) {
  const [labs, setLabs] = useState<LabOrder[]>([]);
  const [imaging, setImaging] = useState<ImagingOrder[]>([]);
  const [ownership, setOwnership] = useState<OwnershipState | null>(null);
  const [loading, setLoading] = useState(true);

  const [transferring, setTransferring] = useState(false);
  const [transferTo, setTransferTo] = useState<Department>("cardiothoracic_surgery");
  const [transferReason, setTransferReason] = useState("");

  async function handleTransfer() {
    if (!transferReason.trim()) return;
    setTransferring(true);
    try {
      const updated = await transferOwnership(intake.case_id, transferTo, transferReason, physicianName);
      setOwnership(updated);
      setTransferReason("");
    } catch (e) {
      console.error(e);
    } finally {
      setTransferring(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLabOrders(intake.case_id),
      fetchImagingOrders(intake.case_id),
      fetchOwnership(intake.case_id),
    ])
      .then(([l, im, own]) => {
        if (cancelled) return;
        setLabs(l);
        setImaging(im);
        setOwnership(own);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [intake.case_id]);

  return (
    <div className="rounded-xl border border-line bg-void-2 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg text-cream">{intake.case_id}</h3>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {intake.diagnosis_id.replace(/_/g, " ")}
          </p>
        </div>
        <Badge variant="outline" className={URGENCY_STYLE[intake.urgency]}>
          {intake.urgency}
        </Badge>
      </div>

      <p className="mb-4 text-[10px] text-muted">
        State persists in audit.db — survives a backend restart.
      </p>

      <div className="mb-5 flex items-start gap-5">
        <PathwayAstrolabe pathways={intake.pathways} />
        <div className="flex flex-1 flex-col gap-1.5 pt-1">
          {ALL_PATHWAYS.map((p) => (
            <div
              key={p}
              className={`flex items-center gap-2 text-[11px] ${
                intake.pathways.includes(p) ? "text-cream" : "text-muted opacity-40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  intake.pathways.includes(p) ? "bg-gold" : "bg-line"
                }`}
              />
              <span className="font-mono uppercase tracking-widest">{p}</span>
              <span>{PATHWAY_LABEL[p]}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading orders…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-gold" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Lab Orders
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {labs.map((o) => (
                <LabRow
                  key={o.id}
                  order={o}
                  caseId={intake.case_id}
                  physicianName={physicianName}
                  onAcknowledged={(updated) =>
                    setLabs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                  }
                  onDraftConfirmed={(updated) =>
                    setLabs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <ScanLine className="h-3.5 w-3.5 text-gold" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Imaging Orders
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {imaging.map((o) => (
                <ImagingRow
                  key={o.id}
                  order={o}
                  caseId={intake.case_id}
                  onUpdated={(updated) =>
                    setImaging((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {ownership && (
        <div className="mt-5 border-t border-line pt-4">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted">
            Ownership Chain
          </span>
          <OwnershipTimeline ownership={ownership} />

          <div className="mt-4 flex flex-col gap-2 rounded-md border border-line bg-void-3 p-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Transfer Ownership</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="h-8 rounded-md bg-void border border-line text-xs text-cream px-2 flex-1 outline-none focus:border-gold/50 transition-colors"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value as Department)}
                disabled={transferring}
              >
                {Object.entries(DEPARTMENT_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                className="h-8 rounded-md bg-void border border-line text-xs text-cream px-3 flex-[2] outline-none focus:border-gold/50 transition-colors"
                placeholder="Reason for transfer..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                disabled={transferring}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTransfer();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-gold/40 text-gold hover:bg-gold/5 uppercase tracking-widest font-mono text-[10px] shrink-0"
                disabled={transferring || !transferReason.trim()}
                onClick={handleTransfer}
              >
                {transferring ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
