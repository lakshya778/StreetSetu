import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../config/jwt.js';

const PASSWORD_SALT_ROUNDS = 12;

export class AuthError extends Error {
	constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
		super(message);
		this.name = 'AuthError';
		this.statusCode = statusCode;
		this.code = code;
	}
}

function publicUser(user) {
	return user.toJSON();
}

function createToken(user) {
	return signToken({
		sub: String(user._id),
		email: user.email,
		role: user.role
	});
}

export async function registerUser({ name, email, password, role = 'citizen' }) {
	if (role === 'admin') {
		throw new AuthError('Admin accounts must be provisioned by an administrator', 403, 'ROLE_NOT_ALLOWED');
	}

	try {
		const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
		const user = await User.create({ name, email, passwordHash, role });

		return { user: publicUser(user), token: createToken(user) };
	} catch (error) {
		if (error?.code === 11000) {
			throw new AuthError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
		}
		throw error;
	}
}

export async function loginUser({ email, password }) {
	const user = await User.findOne({ email }).select('+passwordHash');

	if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
		throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
	}

	return { user: publicUser(user), token: createToken(user) };
}
