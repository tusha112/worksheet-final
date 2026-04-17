require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Verify environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env file.");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post('/create-order', async (req, res) => {
  try {
    const { amount, name } = req.body;
    let orderAmount = Number(amount) || 50;

    if (orderAmount < 20) {
      return res.status(400).json({ error: "Minimum donation amount is ₹20." });
    }

    // Razorpay amount is in paise (1 INR = 100 paise)
    const options = {
      amount: orderAmount * 100,
      currency: "INR",
      receipt: "receipt_" + crypto.randomBytes(4).toString('hex'),
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      throw new Error("Order creation failed.");
    }

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error("Razorpay API Error:", error.message);
    res.status(500).json({
      error: "Failed to create donation order. Please try again later."
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
