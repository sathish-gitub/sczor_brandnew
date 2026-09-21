"use client";

import Link from "next/link";

import { useAccess } from "@/contexts/AccessContext";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PaymentSummary } from "@/components/billing/PaymentSummary";
import { POSCart, cartItemKey, type POSCartItem, type POSStaffOption } from "@/components/billing/POSCart";

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
};

type ProductItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number;
  currentStock: number;
  category: string | null;
};

type CustomerSummary = {
  id: string;
  name: string;
  mobile: string;
  loyalty: {
    totalPoints: number;
  };
};

type PaymentMethod = "CASH" | "UPI" | "CARD";
type DiscountType = "PERCENT" | "FLAT";

type CheckoutSuccess = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  pointsEarned: number;
  totalPoints: number;
};

type ToastMessage = {
  id: string;
  tone: "success" | "error";
  text: string;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toastId() {
  return Math.random().toString(36).slice(2);
}

export default function BillingPage() {
  const access = useAccess();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [staffOptions, setStaffOptions] = useState<POSStaffOption[]>([]);
  const [itemTab, setItemTab] = useState<"SERVICES" | "PRODUCTS">("SERVICES");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

  const [cart, setCart] = useState<POSCartItem[]>([]);

  const [mobileInput, setMobileInput] = useState("");
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const [quickName, setQuickName] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [discountType, setDiscountType] = useState<DiscountType>("FLAT");
  const [discountValue, setDiscountValue] = useState(0);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);

  const [processingPayment, setProcessingPayment] = useState(false);
  const [success, setSuccess] = useState<CheckoutSuccess | null>(null);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(18);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [taxLabel, setTaxLabel] = useState("GST");

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function pushToast(tone: "success" | "error", text: string) {
    const id = toastId();
    setToasts((current) => [...current, { id, tone, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2400);
  }

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { taxBilling?: { gstRate: number; gstEnabled: boolean; taxLabel: string } } | null) => {
        if (data?.taxBilling) {
          setTaxRate(data.taxBilling.gstRate ?? 18);
          setGstEnabled(data.taxBilling.gstEnabled ?? true);
          setTaxLabel(data.taxBilling.taxLabel ?? "GST");
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadServices() {
      setLoadingServices(true);
      const response = await fetch("/api/billing/services", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { error?: string; items?: ServiceItem[] } | null;

      if (!active) {
        return;
      }

      if (!response.ok) {
        pushToast("error", payload?.error ?? "Unable to load services.");
        setLoadingServices(false);
        return;
      }

      setServices(payload?.items ?? []);
      setLoadingServices(false);
    }

    loadServices();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoadingProducts(true);
      const response = await fetch("/api/billing/products", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { error?: string; items?: ProductItem[] } | null;

      if (!active) {
        return;
      }

      if (!response.ok) {
        pushToast("error", payload?.error ?? "Unable to load products.");
        setLoadingProducts(false);
        return;
      }

      setProducts(payload?.items ?? []);
      setLoadingProducts(false);
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStaff() {
      const response = await fetch("/api/staff?status=ACTIVE", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: Array<{ id: string; name: string }> }
        | null;

      if (!active || !response.ok) {
        return;
      }

      setStaffOptions((payload?.items ?? []).map((item) => ({ id: item.id, name: item.name })));
    }

    loadStaff();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!appointmentId) {
      return;
    }

    let active = true;

    async function loadAppointment() {
      const response = await fetch(`/api/appointments/${appointmentId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | {
            appointment?: {
              id: string;
              customer: { id: string; name: string; mobile: string };
              service: { id: string; name: string; price: string | number; duration: number };
              staff: { id: string; name: string };
              invoice?: { id: string } | null;
            };
          }
        | null;

      if (!active || !response.ok || !payload?.appointment) {
        return;
      }

      const appointment = payload.appointment;

      if (appointment.invoice) {
        pushToast("error", "This appointment is already billed.");
        return;
      }

      setLinkedAppointmentId(appointment.id);
      setMobileInput(appointment.customer.mobile);
      setCustomer({
        id: appointment.customer.id,
        name: appointment.customer.name,
        mobile: appointment.customer.mobile,
        loyalty: { totalPoints: 0 },
      });
      setCart([
        {
          type: "SERVICE",
          serviceId: appointment.service.id,
          name: appointment.service.name,
          duration: appointment.service.duration,
          price: Number(appointment.service.price),
          quantity: 1,
          staffId: appointment.staff.id,
          staffName: appointment.staff.name,
        },
      ]);
    }

    loadAppointment();

    return () => {
      active = false;
    };
  }, [appointmentId]);

  useEffect(() => {
    if (!/^\d{10}$/.test(mobileInput)) {
      return;
    }

    let active = true;

    async function searchCustomer() {
      setSearchingCustomer(true);
      setCustomerNotFound(false);

      const response = await fetch(`/api/billing/customer/by-mobile?mobile=${mobileInput}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; customer?: CustomerSummary | null }
        | null;

      if (!active) {
        return;
      }

      if (!response.ok) {
        pushToast("error", payload?.error ?? "Unable to search customer.");
        setSearchingCustomer(false);
        return;
      }

      if (!payload?.customer) {
        setCustomer(null);
        setCustomerNotFound(true);
      } else {
        setCustomer(payload.customer);
        setCustomerNotFound(false);
      }

      setSearchingCustomer(false);
    }

    searchCustomer();

    return () => {
      active = false;
    };
  }, [mobileInput]);

  const categories = useMemo(() => {
    return ["ALL", ...Array.from(new Set(services.map((item) => item.category)))];
  }, [services]);

  const visibleServices = useMemo(() => {
    const input = query.trim().toLowerCase();

    return services.filter((item) => {
      const categoryMatch = category === "ALL" || item.category === category;
      const searchMatch = !input || item.name.toLowerCase().includes(input) || item.category.toLowerCase().includes(input);
      return categoryMatch && searchMatch;
    });
  }, [services, query, category]);

  const visibleProducts = useMemo(() => {
    const input = query.trim().toLowerCase();

    if (itemTab !== "PRODUCTS") {
      return [];
    }

    return products.filter((item) => {
      return !input || item.name.toLowerCase().includes(input) || (item.sku ?? "").toLowerCase().includes(input);
    });
  }, [products, query, itemTab]);

  function addServiceToCart(service: ServiceItem) {
    const key = `SERVICE:${service.id}`;

    setCart((current) => {
      const existing = current.find((item) => cartItemKey(item) === key);

      if (!existing) {
        return [
          ...current,
          {
            type: "SERVICE" as const,
            serviceId: service.id,
            name: service.name,
            duration: service.duration,
            price: service.price,
            quantity: 1,
            staffId: "",
            staffName: "",
          },
        ];
      }

      return current.map((item) =>
        cartItemKey(item) === key
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      );
    });
  }

  function addProductToCart(product: ProductItem) {
    const key = `PRODUCT:${product.id}`;

    setCart((current) => {
      const existing = current.find((item) => cartItemKey(item) === key);

      if (!existing) {
        return [
          ...current,
          {
            type: "PRODUCT" as const,
            productId: product.id,
            name: product.name,
            unit: product.unit,
            price: product.price,
            quantity: 1,
            maxStock: product.currentStock,
          },
        ];
      }

      if (existing.type === "PRODUCT" && existing.quantity >= existing.maxStock) {
        pushToast("error", `Only ${existing.maxStock} ${product.unit} of ${product.name} in stock.`);
        return current;
      }

      return current.map((item) =>
        cartItemKey(item) === key
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      );
    });
  }

  function updateQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (cartItemKey(item) !== key) {
            return item;
          }

          const nextQuantity = Math.max(0, item.quantity + delta);

          if (item.type === "PRODUCT" && delta > 0 && nextQuantity > item.maxStock) {
            pushToast("error", `Only ${item.maxStock} ${item.unit} of ${item.name} in stock.`);
            return item;
          }

          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(key: string) {
    setCart((current) => current.filter((item) => cartItemKey(item) !== key));
  }

  function updateCartStaff(key: string, staffId: string) {
    const staffName = staffOptions.find((option) => option.id === staffId)?.name ?? "";

    setCart((current) =>
      current.map((item) =>
        item.type === "SERVICE" && cartItemKey(item) === key ? { ...item, staffId, staffName } : item,
      ),
    );
  }

  async function quickAddCustomer() {
    if (!quickName.trim() || !/^\d{10}$/.test(mobileInput)) {
      pushToast("error", "Enter customer name and valid mobile.");
      return;
    }

    const response = await fetch("/api/billing/customer/quick-add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: quickName,
        mobile: mobileInput,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          customer?: { id: string; name: string; mobile: string; loyaltyPoints: number };
          alreadyExists?: boolean;
        }
      | null;

    if (!response.ok || !payload?.customer) {
      pushToast("error", payload?.error ?? "Unable to add customer.");
      return;
    }

    setCustomer({
      id: payload.customer.id,
      name: payload.customer.name,
      mobile: payload.customer.mobile,
      loyalty: {
        totalPoints: payload.customer.loyaltyPoints,
      },
    });

    setCustomerNotFound(false);
    setQuickName("");
    pushToast("success", payload.alreadyExists ? "Using existing customer." : "Customer created.");
  }

  const subtotal = useMemo(() => roundMoney(cart.reduce((sum, item) => sum + item.price * item.quantity, 0)), [cart]);
  const discount = useMemo(() => {
    if (discountType === "PERCENT") {
      return roundMoney(Math.min(subtotal, (subtotal * Math.max(0, discountValue)) / 100));
    }

    return roundMoney(Math.min(subtotal, Math.max(0, discountValue)));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = useMemo(() => roundMoney(Math.max(0, subtotal - discount)), [subtotal, discount]);
  const loyaltyMax = useMemo(
    () => Math.min(customer?.loyalty.totalPoints ?? 0, Math.floor(afterDiscount)),
    [customer?.loyalty.totalPoints, afterDiscount],
  );
  const loyaltyDiscount = useMemo(() => {
    if (!useLoyaltyPoints) {
      return 0;
    }

    return roundMoney(Math.min(loyaltyMax, Math.max(0, loyaltyPointsToRedeem)));
  }, [useLoyaltyPoints, loyaltyMax, loyaltyPointsToRedeem]);

  const taxableAmount = useMemo(() => roundMoney(Math.max(0, afterDiscount - loyaltyDiscount)), [afterDiscount, loyaltyDiscount]);
  const gst = useMemo(() => gstEnabled ? roundMoney(taxableAmount * (taxRate / 100)) : 0, [taxableAmount, taxRate, gstEnabled]);
  const cgst = useMemo(() => roundMoney(gst / 2), [gst]);
  const sgst = useMemo(() => roundMoney(gst / 2), [gst]);
  const total = useMemo(() => roundMoney(taxableAmount + gst), [taxableAmount, gst]);

  async function completePayment() {
    if (cart.length === 0) {
      pushToast("error", "Add at least one item to cart.");
      return;
    }

    if (!customer) {
      pushToast("error", "Select a customer before payment.");
      return;
    }

    setProcessingPayment(true);

    const response = await fetch("/api/billing/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customer.id,
        appointmentId: linkedAppointmentId ?? undefined,
        paymentMethod,
        items: cart.map((item) =>
          item.type === "SERVICE"
            ? {
                type: "SERVICE" as const,
                serviceId: item.serviceId,
                quantity: item.quantity,
                staffId: item.staffId || undefined,
              }
            : {
                type: "PRODUCT" as const,
                productId: item.productId,
                quantity: item.quantity,
              },
        ),
        discountType,
        discountValue,
        useLoyaltyPoints,
        loyaltyPointsToRedeem,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          invoiceId?: string;
          invoiceNumber?: string;
          customerName?: string;
          total?: number;
          pointsEarned?: number;
          totalPoints?: number;
        }
      | null;

    if (!response.ok || !payload?.invoiceId || !payload.invoiceNumber || !payload.customerName || payload.total === undefined) {
      pushToast("error", payload?.error ?? "Unable to complete payment.");
      setProcessingPayment(false);
      return;
    }

    setSuccess({
      invoiceId: payload.invoiceId,
      invoiceNumber: payload.invoiceNumber,
      customerName: payload.customerName,
      total: payload.total,
      pointsEarned: payload.pointsEarned ?? 0,
      totalPoints: payload.totalPoints ?? customer.loyalty.totalPoints,
    });

    setProcessingPayment(false);
    pushToast("success", "Payment completed successfully.");
  }

  function resetForNewSale() {
    setCart([]);
    setMobileInput("");
    setCustomer(null);
    setLinkedAppointmentId(null);
    setCustomerNotFound(false);
    setQuickName("");
    setDiscountType("FLAT");
    setDiscountValue(0);
    setUseLoyaltyPoints(false);
    setLoyaltyPointsToRedeem(0);
    setPaymentMethod("CASH");
    setSuccess(null);
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-6 text-center">
        <p className="text-3xl">Success</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Payment Successful!</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">Invoice #{success.invoiceNumber}</p>
        <p className="text-sm text-[var(--muted)]">Customer: {success.customerName}</p>
        <p className="text-sm text-[var(--muted)]">Amount: {formatCurrency(success.total)}</p>

        <p className="mt-4 text-sm font-semibold text-amber-700">
          {success.pointsEarned} loyalty points earned. Total points: {success.totalPoints}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => window.open(`/billing/invoices/${success.invoiceId}`, "_blank")}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Print Receipt
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Invoice ${success.invoiceNumber} - ${formatCurrency(success.total)}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Send on WhatsApp
          </a>
          <button
            type="button"
            onClick={resetForNewSale}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"
          >
            New Sale
          </button>
          <Link
            href={`/billing/invoices/${success.invoiceId}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            View Invoice
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="fixed right-4 top-20 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "rounded-xl px-4 py-3 text-sm font-medium shadow",
              toast.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Billing / POS</h1>
          <p className="text-sm text-[var(--muted)]">Fast checkout with loyalty, GST, and invoice generation.</p>
        </div>

        <Link
          href="/billing/invoices"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Invoices
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setItemTab("SERVICES")}
              className={[
                "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold",
                itemTab === "SERVICES"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--border)] bg-white text-slate-700",
              ].join(" ")}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => setItemTab("PRODUCTS")}
              className={[
                "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold",
                itemTab === "PRODUCTS"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--border)] bg-white text-slate-700",
              ].join(" ")}
            >
              Products
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={itemTab === "SERVICES" ? "Search services..." : "Search products..."}
              className="h-10 w-full rounded-xl border border-[var(--border)] pl-9 pr-3 text-sm"
            />
          </div>

          {itemTab === "SERVICES" ? (
            <>
              <div className="flex flex-wrap gap-2">
                {categories.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCategory(tab)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      category === tab
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-[var(--border)] bg-white text-slate-700",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {loadingServices ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-slate-50" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleServices.map((service) => (
                    <article key={service.id} className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{service.name}</p>
                      <p className="text-xs text-[var(--muted)]">{formatCurrency(service.price)}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{service.duration} min</p>
                      <button
                        type="button"
                        onClick={() => addServiceToCart(service)}
                        className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white"
                      >
                        + Add
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : loadingProducts ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-slate-50" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => {
                const outOfStock = product.currentStock <= 0;

                return (
                  <article
                    key={product.id}
                    className={[
                      "rounded-xl border p-3",
                      outOfStock ? "border-[var(--border)] bg-slate-100 opacity-60" : "border-[var(--border)] bg-slate-50",
                    ].join(" ")}
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">{product.name}</p>
                    <p className="text-xs text-[var(--muted)]">{formatCurrency(product.price)}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {outOfStock ? "Out of stock" : `${product.currentStock} ${product.unit} in stock`}
                    </p>
                    <button
                      type="button"
                      onClick={() => addProductToCart(product)}
                      disabled={outOfStock}
                      className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <section className="rounded-xl border border-[var(--border)] bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Customer</h2>
            <input
              value={mobileInput}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 10);
                setMobileInput(next);

                if (next.length < 10) {
                  setCustomer(null);
                  setCustomerNotFound(false);
                }
              }}
              placeholder="Search by mobile..."
              className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm"
            />

            {searchingCustomer ? <p className="mt-2 text-xs text-[var(--muted)]">Searching...</p> : null}

            {customer ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-700">{customer.name}</p>
                <p className="text-xs text-emerald-700">Loyalty: {customer.loyalty.totalPoints} pts = {formatCurrency(customer.loyalty.totalPoints)}</p>
              </div>
            ) : null}

            {customerNotFound ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-700">Customer not found. Quick add new customer.</p>
                <input
                  value={quickName}
                  onChange={(event) => setQuickName(event.target.value)}
                  placeholder="Customer name"
                  className="mt-2 h-9 w-full rounded-lg border border-amber-200 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={quickAddCustomer}
                  className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white"
                >
                  Quick Add
                </button>
              </div>
            ) : null}
          </section>

          <POSCart
            items={cart}
            staffOptions={staffOptions}
            onIncrease={(serviceId) => updateQuantity(serviceId, 1)}
            onDecrease={(serviceId) => updateQuantity(serviceId, -1)}
            onRemove={removeFromCart}
            onStaffChange={updateCartStaff}
          />

          <PaymentSummary
            taxRate={taxRate}
            taxLabel={taxLabel}
            value={{
              subtotal,
              discountValue,
              discount,
              discountType,
              loyaltyDiscount,
              taxableAmount,
              cgst,
              sgst,
              total,
              paymentMethod,
              useLoyaltyPoints,
              loyaltyPointsToRedeem,
              loyaltyPointsAvailable: customer?.loyalty.totalPoints ?? 0,
            }}
            onPaymentMethodChange={setPaymentMethod}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
            onLoyaltyToggle={(enabled) => {
              setUseLoyaltyPoints(enabled);
              if (!enabled) {
                setLoyaltyPointsToRedeem(0);
              }
            }}
            onLoyaltyPointsChange={(value) => setLoyaltyPointsToRedeem(Math.min(value, loyaltyMax))}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                const text = `Billing total ${formatCurrency(total)} for ${customer?.name ?? "customer"}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
            >
              WhatsApp
            </button>
          </div>

          <button
            type="button"
            onClick={completePayment}
            disabled={processingPayment || access.accessLevel === "READ_ONLY"}
            title={access.accessLevel === "READ_ONLY" ? "Subscription required to record payments" : undefined}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {access.accessLevel === "READ_ONLY" ? "Subscription Required" : processingPayment ? "Processing..." : "Complete Payment"}
          </button>
        </section>
      </div>
    </div>
  );
}
