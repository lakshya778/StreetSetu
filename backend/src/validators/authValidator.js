const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTERED_ROLES = new Set(['citizen', 'volunteer']);

function validationError(details) {
	const error = new Error('The request payload is invalid');
	error.statusCode = 400;
	error.code = 'VALIDATION_ERROR';
	error.details = details;
	return error;
}

function validateCommonCredentials(body) {
	const details = [];
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body?.password === 'string' ? body.password : '';

	if (!EMAIL_PATTERN.test(email)) {
		details.push({ field: 'email', message: 'A valid email is required' });
	}
	if (password.length < 8 || password.length > 72) {
		details.push({ field: 'password', message: 'Password must be between 8 and 72 characters' });
	}

	return { details, email, password };
}

export function validateRegister(req, res, next) {
	const { details, email, password } = validateCommonCredentials(req.body);
	const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
	const role = req.body?.role || 'citizen';
	const requestedLocation = req.body?.location;
	let location;

	if (name.length < 2 || name.length > 100) {
		details.push({ field: 'name', message: 'Name must be between 2 and 100 characters' });
	}
	if (!REGISTERED_ROLES.has(role)) {
		details.push({ field: 'role', message: 'Role must be citizen or volunteer' });
	}
	if (requestedLocation !== undefined && requestedLocation !== null
		&& (typeof requestedLocation !== 'object' || Array.isArray(requestedLocation))) {
		details.push({ field: 'location', message: 'Location must be a GeoJSON Point' });
	} else if (requestedLocation?.coordinates !== undefined && requestedLocation.coordinates !== null) {
		const coordinates = requestedLocation.coordinates;
		if (!Array.isArray(coordinates)) {
			details.push({ field: 'location', message: 'Coordinates must contain longitude and latitude' });
		} else if (coordinates.length === 2) {
			const [longitude, latitude] = coordinates;
			if ((requestedLocation.type !== undefined && requestedLocation.type !== 'Point')
				|| !Number.isFinite(longitude) || longitude < -180 || longitude > 180
				|| !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
				details.push({ field: 'location', message: 'Coordinates must be a valid GeoJSON Point [longitude, latitude]' });
			} else {
				location = { type: 'Point', coordinates: [longitude, latitude] };
			}
		} else if (coordinates.length > 2) {
			details.push({ field: 'location', message: 'Coordinates must contain longitude and latitude' });
		}
	}
	if (details.length > 0) {
		return next(validationError(details));
	}

	req.body = { name, email, password, role, ...(location ? { location } : {}) };
	return next();
}

export function validateLogin(req, res, next) {
	const { details, email, password } = validateCommonCredentials(req.body);
	if (details.length > 0) {
		return next(validationError(details));
	}

	req.body = { email, password };
	return next();
}
