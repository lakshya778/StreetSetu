import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'StreetSetu API is healthy' });
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streetsetu')
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`StreetSetu API running on port ${PORT}`));
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });
