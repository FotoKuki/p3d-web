"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  LogOut,
  Palette,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import BrandLink from "../../brand-link";
import ThemeToggle from "../../theme-toggle";
import { deleteAdminOrder, leaveAdmin, restoreAdminOrder } from "../actions";
import { orderStatusLabel, orderAssignees } from "../../../lib/order-progress";
import { orderNumber } from "../../orders/order-list";
import StlThumbnail from "./stl-thumbnail";
import AssigneeSelect from "./assignee-select";
import styles from "./admin-orders.module.css";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateHeaderFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const shortDateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Bangkok",
});

function statusBucket(status) {
  if (status === "printing") return "printing";
  if (status === "ready_to_ship" || status === "shipped" || status === "delivered") return "done";
  return "review";
}

function customerDisplayName(order) {
  return (
    order.shipping?.contactName?.trim() ||
    order.shipping?.recipient?.trim() ||
    order.customerName?.trim() ||
    order.shipping?.email?.trim() ||
    order.customerEmail?.trim() ||
    "ไม่ระบุชื่อลูกค้า"
  );
}

const STATUS_FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "review", label: "รอตรวจสอบ / รอคิว" },
  { id: "printing", label: "กำลังพิมพ์" },
  { id: "done", label: "เสร็จแล้ว" },
];

export default function OrdersDashboard({ initialOrders, viewer }) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [undoStack, setUndoStack] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const toastTimerRef = useRef(null);

  const resetToastTimer = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setUndoStack([]);
    }, 10000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleAssigned = (orderId, nextAssignee) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, assignee: nextAssignee } : order))
    );
  };

  const handleDeleteOrder = async (order) => {
    setOrders((prev) => prev.filter((item) => item.id !== order.id));
    setUndoStack((prev) => [...prev, order]);
    resetToastTimer();

    const result = await deleteAdminOrder(order.id);
    if (!result?.ok) {
      setOrders((prev) =>
        prev.some((item) => item.id === order.id)
          ? prev
          : [...prev, order].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      );
      setUndoStack((prev) => prev.filter((item) => item.id !== order.id));
    }
  };

  const handleUndoDelete = async () => {
    if (restoring || undoStack.length === 0) return;
    const target = undoStack[undoStack.length - 1];
    setRestoring(true);
    setUndoStack((prev) => prev.slice(0, -1));
    setOrders((prev) =>
      prev.some((item) => item.id === target.id)
        ? prev
        : [...prev, target].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    );

    const result = await restoreAdminOrder(target.id);
    setRestoring(false);
    if (!result?.ok) {
      setOrders((prev) => prev.filter((item) => item.id !== target.id));
      setUndoStack((prev) => [...prev, target]);
    } else if (undoStack.length > 1) {
      resetToastTimer();
    } else if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  };

  const handleDismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoStack([]);
  };

  const stats = useMemo(() => {
    let review = 0;
    let printing = 0;
    let done = 0;
    let revenue = 0;
    for (const order of orders) {
      const bucket = statusBucket(order.status);
      if (bucket === "review") review += 1;
      else if (bucket === "printing") printing += 1;
      else done += 1;
      revenue += Number(order.quote?.total || 0);
    }
    return { total: orders.length, review, printing, done, revenue };
  }, [orders]);

  const materialOptions = useMemo(() => {
    const base = new Set(["PLA", "PETG", "ABS"]);
    for (const order of orders) {
      if (order.printSettings?.material) base.add(order.printSettings.material);
    }
    return Array.from(base);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && statusBucket(order.status) !== statusFilter) return false;
      if (materialFilter !== "all" && order.printSettings?.material !== materialFilter) return false;
      if (assigneeFilter === "unassigned" && (order.assignee || "") !== "") return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        (order.assignee || "") !== assigneeFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        orderNumber(order.id),
        order.fileName,
        customerDisplayName(order),
        order.shipping?.phone,
        order.printSettings?.material,
        order.assignee,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, query, statusFilter, materialFilter, assigneeFilter]);

  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const order of filteredOrders) {
      const ts = Number(order.createdAt) || Date.now();
      const date = new Date(ts);
      const key = dayKeyFormatter.format(date);
      if (!map.has(key)) {
        map.set(key, { key, label: dateHeaderFormatter.format(date), items: [] });
      }
      map.get(key).items.push(order);
    }
    return Array.from(map.values());
  }, [filteredOrders]);

  const hasActiveFilters =
    query !== "" || statusFilter !== "all" || materialFilter !== "all" || assigneeFilter !== "all";
  const adminHandle = viewer?.email ? viewer.email.split("@")[0] : "Admin";

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.topbarLeft}>
            <BrandLink />
            <span className={styles.brandDivider} aria-hidden="true" />
            <span className={styles.adminBadge}>
              <ShieldCheck size={14} aria-hidden="true" />
              หลังบ้าน P3D
            </span>
            <nav className={styles.adminNav} aria-label="เมนูหลังบ้าน">
              <Link href="/admin/orders" className={`${styles.adminNavLink} ${styles.adminNavActive}`} aria-current="page">
                <ClipboardList size={15} aria-hidden="true" />
                <span>คำสั่งพิมพ์</span>
              </Link>
              <Link href="/admin/stock" className={styles.adminNavLink}>
                <Palette size={15} aria-hidden="true" />
                <span>สต๊อกเส้น</span>
              </Link>
            </nav>
          </div>

          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="ค้นหาชื่อลูกค้า, ไฟล์ STL, เลขคำสั่ง, ผู้ดูแล..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="ค้นหาคำสั่งพิมพ์"
            />
            {query && (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.topbarRight}>
            <ThemeToggle />
            <span className={styles.userPill} title={viewer?.email || ""}>
              <span className={styles.onlineDot} aria-hidden="true" />
              <span>{adminHandle}</span>
            </span>
            <form action={leaveAdmin}>
              <button type="submit" className={styles.logoutBtn}>
                <LogOut size={15} aria-hidden="true" />
                <span>ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className={styles.workspace}>
        {/* Page Heading */}
        <div className={styles.pageHeader}>
          <div>
            <h1>คำสั่งพิมพ์ของร้าน</h1>
            <p>ตรวจสอบไฟล์ STL มอบหมายผู้ดูแลคิว และติดตามสถานะงานพิมพ์ทั้งหมด</p>
          </div>
          <Link className={styles.stockLink} href="/admin/stock">สต๊อกเส้น</Link>
        </div>

        {/* KPI Overview Grid */}
        <section className={styles.kpiGrid} aria-label="สรุปภาพรวมคำสั่งพิมพ์">
          <button
            type="button"
            className={`${styles.kpiCard} ${statusFilter === "all" ? styles.kpiActive : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>งานทั้งหมด</span>
              <span className={`${styles.kpiIcon} ${styles.kpiIconNeutral}`}>
                <Layers size={16} aria-hidden="true" />
              </span>
            </div>
            <strong className={styles.kpiValue}>{stats.total}</strong>
            <span className={styles.kpiHint}>เสร็จแล้ว {stats.done} งาน</span>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${statusFilter === "review" ? styles.kpiActive : ""}`}
            onClick={() => setStatusFilter("review")}
          >
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>รอตรวจสอบ / รอคิว</span>
              <span className={`${styles.kpiIcon} ${styles.kpiIconAmber}`}>
                <Clock size={16} aria-hidden="true" />
              </span>
            </div>
            <strong className={styles.kpiValue}>{stats.review}</strong>
            <span className={styles.kpiHint}>รอชำระเงินหรือรอเริ่มพิมพ์</span>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${statusFilter === "printing" ? styles.kpiActive : ""}`}
            onClick={() => setStatusFilter("printing")}
          >
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>กำลังพิมพ์</span>
              <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>
                <Printer size={16} aria-hidden="true" />
              </span>
            </div>
            <strong className={styles.kpiValue}>{stats.printing}</strong>
            <span className={styles.kpiHint}>กำลังดำเนินการบนเครื่องพิมพ์</span>
          </button>

          <div className={`${styles.kpiCard} ${styles.kpiStatic}`}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>ยอดรวมทั้งหมด</span>
              <span className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                <Wallet size={16} aria-hidden="true" />
              </span>
            </div>
            <strong className={styles.kpiValue}>฿{money.format(stats.revenue)}</strong>
            <span className={styles.kpiHint}>จาก {stats.total} คำสั่งพิมพ์</span>
          </div>
        </section>

        {/* Unified Filter Toolbar */}
        <section className={styles.toolbar} aria-label="ตัวกรองคำสั่งพิมพ์">
          <div className={styles.segmented} role="group" aria-label="กรองตามสถานะ">
            {STATUS_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.segBtn} ${statusFilter === tab.id ? styles.segBtnActive : ""}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.chipGroup} role="group" aria-label="กรองตามผู้ดูแล">
              <span className={styles.chipLabel}>ผู้ดูแล</span>
              <button
                type="button"
                className={`${styles.chip} ${assigneeFilter === "all" ? styles.chipActive : ""}`}
                onClick={() => setAssigneeFilter("all")}
              >
                ทุกคน
              </button>
              {orderAssignees.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.chip} ${assigneeFilter === name ? styles.chipActive : ""}`}
                  onClick={() => setAssigneeFilter(name)}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.chip} ${assigneeFilter === "unassigned" ? styles.chipActive : ""}`}
                onClick={() => setAssigneeFilter("unassigned")}
              >
                ยังไม่ระบุ
              </button>
            </div>

            <div className={styles.chipGroup} role="group" aria-label="กรองตามวัสดุ">
              <span className={styles.chipLabel}>วัสดุ</span>
              <button
                type="button"
                className={`${styles.chip} ${materialFilter === "all" ? styles.chipActive : ""}`}
                onClick={() => setMaterialFilter("all")}
              >
                ทั้งหมด
              </button>
              {materialOptions.map((mat) => (
                <button
                  key={mat}
                  type="button"
                  className={`${styles.chip} ${materialFilter === mat ? styles.chipActive : ""}`}
                  onClick={() => setMaterialFilter(mat)}
                >
                  {mat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Date-grouped Order Cards */}
        {groupedByDate.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle2 size={28} aria-hidden="true" />
            <p>ไม่พบคำสั่งพิมพ์ที่ตรงกับเงื่อนไข</p>
            {hasActiveFilters && (
              <button
                type="button"
                className={styles.resetFilterBtn}
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setMaterialFilter("all");
                  setAssigneeFilter("all");
                }}
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className={styles.dateGroups}>
            {groupedByDate.map((group) => (
              <section key={group.key} className={styles.dateSection} aria-label={group.label}>
                <div className={styles.dateHeader}>
                  <h2>{group.label}</h2>
                  <span className={styles.dateCount}>{group.items.length} งาน</span>
                  <span className={styles.dateRule} aria-hidden="true" />
                </div>

                <div className={styles.cardGrid}>
                  {group.items.map((order) => {
                    const bucket = statusBucket(order.status);
                    const stepLabel = orderStatusLabel(order);
                    const badgeClass =
                      bucket === "printing"
                        ? styles.statusPrinting
                        : bucket === "done"
                          ? styles.statusDone
                          : styles.statusReview;
                    const accentClass =
                      bucket === "printing"
                        ? styles.accentPrinting
                        : bucket === "done"
                          ? styles.accentDone
                          : styles.accentReview;

                    return (
                      <article key={order.id} className={`${styles.orderCard} ${accentClass}`}>
                        <Link href={"/admin/orders/" + order.id} className={styles.cardBody}>
                          <StlThumbnail
                            orderId={order.id}
                            fileName={order.fileName}
                            color={order.printSettings?.color}
                          />

                          <div className={styles.cardInfo}>
                            <div className={styles.cardTopMeta}>
                              <span className={styles.orderCode}>{orderNumber(order.id)}</span>
                              <span className={`${styles.statusBadge} ${badgeClass}`}>
                                {stepLabel}
                              </span>
                            </div>

                            <strong className={styles.fileName} title={order.fileName}>
                              {order.fileName}
                            </strong>

                            <div className={styles.customerRow}>
                              <UserRound size={14} aria-hidden="true" />
                              <span className={styles.customerName} title={customerDisplayName(order)}>
                                {customerDisplayName(order)}
                              </span>
                            </div>

                            <div className={styles.specRow}>
                              <span>
                                {shortDateFormatter.format(new Date(Number(order.createdAt) || Date.now()))}
                              </span>
                              {order.printSettings?.material && (
                                <span className={styles.materialTag}>
                                  {order.printSettings.material}
                                  {order.printSettings.quantity > 1 ? ` ×${order.printSettings.quantity}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>

                        <div className={styles.cardFooter}>
                          <div className={styles.priceBlock}>
                            <span className={styles.priceLabel}>ยอดรวม</span>
                            <strong className={styles.price}>฿{money.format(order.quote.total)}</strong>
                          </div>

                          <div className={styles.caretakerBlock}>
                            <span className={styles.caretakerLabel}>ผู้ดูแล</span>
                            <AssigneeSelect
                              orderId={order.id}
                              value={order.assignee || ""}
                              onAssigned={handleAssigned}
                            />
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteOrder(order)}
                              title={`ลบคิว ${orderNumber(order.id)}`}
                              aria-label={`ลบคิว ${orderNumber(order.id)}`}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {undoStack.length > 0 && (
        <div className={styles.undoToast} role="status" aria-live="polite">
          <div className={styles.undoText}>
            <strong>ลบคิว {orderNumber(undoStack[undoStack.length - 1].id)} แล้ว</strong>
            <span>
              {undoStack[undoStack.length - 1].fileName}
              {undoStack.length > 1 ? ` (+${undoStack.length - 1} รายการ)` : ""}
            </span>
          </div>
          <div className={styles.undoActions}>
            <button
              type="button"
              className={styles.undoBtn}
              onClick={handleUndoDelete}
              disabled={restoring}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>เลิกทำ (Undo)</span>
            </button>
            <button
              type="button"
              className={styles.undoClose}
              onClick={handleDismissToast}
              aria-label="ปิดแถบแจ้งเตือน"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
