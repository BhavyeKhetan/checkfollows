import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ hasCardOnFile: false });
    }

    const stripe = getStripe();
    let paymentMethodId: string | null = null;

    // Check subscription default payment method first
    if (sub.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(
          sub.stripe_subscription_id
        );
        if (typeof stripeSub.default_payment_method === "string") {
          paymentMethodId = stripeSub.default_payment_method;
        } else if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method === "object") {
          paymentMethodId = stripeSub.default_payment_method.id;
        }
      } catch {
        /* fallback to customer */
      }
    }

    // Check customer invoice_settings default payment method
    if (!paymentMethodId) {
      try {
        const customer = await stripe.customers.retrieve(sub.stripe_customer_id);
        if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
          const dpm = customer.invoice_settings.default_payment_method;
          paymentMethodId = typeof dpm === "string" ? dpm : dpm.id;
        }
      } catch {
        /* fallback to payment methods list */
      }
    }

    // Fallback: list cards attached to customer
    if (!paymentMethodId) {
      try {
        const pms = await stripe.paymentMethods.list({
          customer: sub.stripe_customer_id,
          type: "card",
          limit: 1,
        });
        paymentMethodId = pms.data[0]?.id || null;
      } catch {
        /* ignore */
      }
    }

    if (!paymentMethodId) {
      return NextResponse.json({ hasCardOnFile: false });
    }

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm.card) {
      return NextResponse.json({ hasCardOnFile: false });
    }

    return NextResponse.json({
      hasCardOnFile: true,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      },
    });
  } catch (error) {
    console.error("Error retrieving payment method:", error);
    return NextResponse.json({ hasCardOnFile: false });
  }
}
