"use client";

import { useState, useEffect, useRef } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export type CheckoutCadence = "weekly" | "quarterly";

interface EmbeddedCheckoutProps {
  cadence: CheckoutCadence;
  tier?: "base" | "premium";
  emailAlerts: boolean;
  email: string;
  username?: string;
  targetId?: string;
  relationship?: string;
  onSuccess?: () => void;
}

const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#121212",
    colorBackground: "#FFFFFF",
    colorText: "#121212",
    colorTextSecondary: "#555555",
    colorDanger: "#B91C1C",
    borderRadius: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
};

type ConfirmPayment = (
  stripe: Stripe,
  elements: StripeElements,
  requireEmail: boolean
) => Promise<void>;

function UnifiedWalletButtons({
  clientSecret,
  payerEmail,
  onConfirm,
}: {
  clientSecret: string;
  payerEmail: string;
  onConfirm: ConfirmPayment;
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: stripeAppearance }}
    >
      <UnifiedWalletButtonsInner payerEmail={payerEmail} onConfirm={onConfirm} />
    </Elements>
  );
}

function UnifiedWalletButtonsInner({
  payerEmail,
  onConfirm,
}: {
  payerEmail: string;
  onConfirm: ConfirmPayment;
}) {
  const stripe = useStripe();
  const elements = useElements();

  return (
    <ExpressCheckoutElement
      options={{
        buttonHeight: 48,
        buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
        paymentMethods: {
          applePay: "auto" as const,
          googlePay: "auto" as const,
          link: "auto" as const,
          amazonPay: "never" as const,
          klarna: "never" as const,
          paypal: "never" as const,
        },
        layout: { maxColumns: 1, maxRows: 2 },
      }}
      onConfirm={() => {
        if (stripe && elements) {
          void onConfirm(stripe, elements, !isValidEmail(payerEmail));
        }
      }}
    />
  );
}

function CardPaymentForm({
  clientSecret,
  loading,
  onConfirm,
}: {
  clientSecret: string;
  loading: boolean;
  onConfirm: ConfirmPayment;
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: stripeAppearance }}
    >
      <CardPaymentFormInner loading={loading} onConfirm={onConfirm} />
    </Elements>
  );
}

function CardPaymentFormInner({
  loading,
  onConfirm,
}: {
  loading: boolean;
  onConfirm: ConfirmPayment;
}) {
  const stripe = useStripe();
  const elements = useElements();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (stripe && elements) void onConfirm(stripe, elements, true);
      }}
      className="space-y-3"
    >
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: {
            applePay: "never",
            googlePay: "never",
            link: "never",
          },
        }}
      />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3.5 px-4 rounded-xl bg-[#E7F256] hover:bg-[#DAE64A] disabled:opacity-50 text-[#121212] font-bold text-base flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all active:scale-[0.99]"
      >
        <Lock size={16} />
        <span>{loading ? "Processing..." : "Subscribe"}</span>
      </button>
    </form>
  );
}

function isValidEmail(email?: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

function CheckoutFormInner({
  clientSecret,
  cadence,
  subscriptionId,
  defaultEmail,
  username,
  targetId,
  relationship,
  onSuccess,
}: {
  clientSecret: string;
  cadence: string;
  subscriptionId: string;
  defaultEmail?: string;
  username?: string;
  targetId?: string;
  relationship?: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payerEmail, setPayerEmail] = useState(
    isValidEmail(defaultEmail) ? defaultEmail!.trim() : ""
  );

  useEffect(() => {
    if (isValidEmail(defaultEmail) && !payerEmail) {
      setPayerEmail(defaultEmail!.trim());
    }
  }, [defaultEmail, payerEmail]);

  const finalizeActivation = async () => {
    try {
      await fetch("/api/stripe/activate-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          email: payerEmail,
          username,
          target_id: targetId,
        }),
      });
    } catch (err) {
      console.error("activate-subscription failed:", err);
    }
  };

  const confirmPayment: ConfirmPayment = async (stripe, elements, requireEmail) => {
    if (requireEmail && !payerEmail.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setError("");

    // Persist context so a 3DS redirect back can finalize the activation.
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "cf_checkout_ctx",
          JSON.stringify({
            subscription_id: subscriptionId,
            email: payerEmail,
            username,
            target_id: targetId,
          })
        );
      }
    } catch {
      /* ignore */
    }

    const returnUrl = `${window.location.origin}/onboarding?finalize=1`;

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        ...(payerEmail.includes("@") ? { receipt_email: payerEmail } : {}),
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setLoading(false);
      return;
    }

    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      // Either a redirect is underway (3DS) or still processing.
      if (paymentIntent && paymentIntent.status === "processing") {
        setError("Payment is still processing. Please wait and try again.");
      }
      setLoading(false);
      return;
    }

    // Payment succeeded in-place → activate + advance.
    await finalizeActivation();
    onSuccess?.();
  };

  return (
    <div className="p-3 space-y-3">
      {/* EMAIL INPUT */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-[#555555] block">
          Email for alerts &amp; receipt
        </label>
        <input
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full p-3 rounded-xl bg-[#FFFFFF] border border-[#E2E2DC] text-[#121212] placeholder-[#B9B9B2] text-sm font-medium focus:outline-none focus:border-[#121212] transition-colors"
        />
      </div>

      {/* Express Checkout Wallets (Apple Pay, Google Pay, Link) */}
      <div className="pt-1">
        <UnifiedWalletButtons
          clientSecret={clientSecret}
          payerEmail={payerEmail}
          onConfirm={confirmPayment}
        />
      </div>

      <CardPaymentForm
        clientSecret={clientSecret}
        loading={loading}
        onConfirm={confirmPayment}
      />

      {/* ERROR MESSAGE */}
      {error && (
        <p className="text-xs text-[#B91C1C] text-center font-semibold pt-1">
          {error}
        </p>
      )}
    </div>
  );
}

// In-memory cache so the client secret loads instantly and isn't re-fetched.
const clientSecretCache = new Map<
  string,
  { clientSecret: string; subscriptionId: string }
>();

function cacheKeyFor(
  cadence: string,
  tier: string,
  emailAlerts: boolean,
  email: string
): string {
  return `cf-payment-${cadence}-${tier}-${emailAlerts ? "alerts" : "base"}-${email}`;
}

export default function EmbeddedCheckout({
  cadence,
  tier = "base",
  emailAlerts,
  email,
  username,
  targetId,
  relationship,
  onSuccess,
}: EmbeddedCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string>("");
  const [error, setError] = useState("");
  const fetchingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isValidEmail(email)) return;

    const cacheKey = cacheKeyFor(cadence, tier, emailAlerts, email.trim());
    const cached = clientSecretCache.get(cacheKey);
    if (cached) {
      setClientSecret(cached.clientSecret);
      setSubscriptionId(cached.subscriptionId);
      return;
    }

    if (fetchingRef.current === cacheKey) return;
    fetchingRef.current = cacheKey;

    fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cadence,
        tier,
        email_alerts: emailAlerts,
        email: email.trim(),
        username,
        targetId,
        relationship,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        fetchingRef.current = null;
        if (data.clientSecret) {
          clientSecretCache.set(cacheKey, {
            clientSecret: data.clientSecret,
            subscriptionId: data.subscriptionId,
          });
          setClientSecret(data.clientSecret);
          setSubscriptionId(data.subscriptionId);
        } else {
          setError(data.error || "Failed to initialize checkout");
        }
      })
      .catch(() => {
        fetchingRef.current = null;
        setError("Failed to connect to payment server");
      });
  }, [cadence, tier, emailAlerts, email, username, targetId, relationship]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[#B91C1C] mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-[#121212] underline font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="w-full space-y-4 animate-pulse p-2">
        <div className="w-full h-12 bg-[#EDEDE8] rounded-xl flex items-center justify-center border border-[#E2E2DC]">
          <span className="text-[#777777] font-bold text-sm"> Pay</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-11 bg-[#F3F3EF] rounded-xl border border-[#E2E2DC] flex items-center justify-center">
            <span className="text-[#555555] font-bold text-xs">link</span>
          </div>
          <div className="h-11 bg-[#F3F3EF] rounded-xl border border-[#E2E2DC] flex items-center justify-center">
            <span className="text-[#555555] font-bold text-xs">G Pay</span>
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 w-28 bg-[#EDEDE8] rounded" />
          <div className="h-12 bg-[#F9F9F7] rounded-xl border border-[#E2E2DC] flex items-center px-4">
            <span className="text-[#C9C9C0] text-xs font-mono">
              •••• •••• •••• ••••
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CheckoutFormInner
      clientSecret={clientSecret}
      cadence={cadence}
      subscriptionId={subscriptionId}
      defaultEmail={email}
      username={username}
      targetId={targetId}
      relationship={relationship}
      onSuccess={onSuccess}
    />
  );
}
