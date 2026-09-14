import User from '../models/User.js';
import { signToken } from '../config/jwt.js';
import bcrypt from 'bcryptjs';

export async function register(req, res) {
  const { name, email, password } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  res.status(201).json({
    success: true,
    data: {
      user,
      token: signToken({ sub: user._id, email: user.email, role: user.role })
    },
    message: 'User registered successfully'
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  res.json({
    success: true,
    data: {
      user,
      token: signToken({ sub: user._id, email: user.email, role: user.role })
    },
    message: 'Login successful'
  });
}
