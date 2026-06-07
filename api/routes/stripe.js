import express from "express";
import Stripe from "stripe";
import prisma from "../lib/prisma.js";
import { requireClerk } from "../middleware/requireClerk.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_MAP = {
    [process.env.STRIPE_PRICE_PRO]:  { plan: 'pro',  repoLimit: 10 },
    [process.env.STRIPE_PRICE_TEAM]: { plan: 'team', repoLimit: 50 },
};

router.post("/stripe/checkout", requireClerk, async (req, res) => {
    const { priceId } = req.body;
    if(!priceId) {
        return res.status(400).json({ error: "Invalid priceId" });
    }
    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=1`,
            cancel_url:  `${process.env.FRONTEND_URL}/pricing`,
            metadata: { userId: req.userId },
        });
        res.json({ url: session.url });
    } catch (err) {
        console.error('[stripe] checkout error:', err.type, err.message, err.raw?.message);
        res.status(500).json({ error: 'Failed to create checkout session', detail: err.message });
    }
});
 // POST /api/stripe/webhook — Stripe sends payment events here
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items'],
      });
      const paidPriceId = fullSession.line_items?.data[0]?.price?.id;
      const upgrade = PLAN_MAP[paidPriceId];

      if (userId && upgrade) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: upgrade.plan, repoLimit: upgrade.repoLimit },
        });
        console.log(`[stripe] upgraded ${userId} → ${upgrade.plan}`);
      }
    }

    res.json({ received: true });
});


export default router;
    