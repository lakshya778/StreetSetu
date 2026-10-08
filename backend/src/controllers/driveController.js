import { createDrive, getDrive, joinDrive, leaveDrive, listDrives } from '../services/driveService.js';

export async function list(req, res, next) {
  try { return res.json({ success: true, data: await listDrives(req), message: 'Upcoming drives loaded' }); }
  catch (error) { return next(error); }
}

export async function detail(req, res, next) {
  try { return res.json({ success: true, data: await getDrive(req.params.id, req), message: 'Drive loaded' }); }
  catch (error) { return next(error); }
}

export async function create(req, res, next) {
  try { return res.status(201).json({ success: true, data: await createDrive(req.body, req), message: 'Drive created successfully' }); }
  catch (error) { return next(error); }
}

export async function join(req, res, next) {
  try { return res.json({ success: true, data: await joinDrive(req.params.id, req), message: 'You joined the drive' }); }
  catch (error) { return next(error); }
}

export async function leave(req, res, next) {
  try { return res.json({ success: true, data: await leaveDrive(req.params.id, req), message: 'You left the drive' }); }
  catch (error) { return next(error); }
}
