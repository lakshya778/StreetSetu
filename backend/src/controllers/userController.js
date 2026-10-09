import { updateVolunteerProfile } from '../services/userService.js';
import { getMyGamificationStats } from '../services/gamificationService.js';
import { downloadMyCertificate, getMyCertificates } from '../services/monthlyGamificationService.js';

export async function myGamificationStats(req, res, next) {
  try {
    return res.json({ success: true, data: await getMyGamificationStats(req.user.sub), message: 'Your impact stats loaded' });
  } catch (error) {
    return next(error);
  }
}

export async function myCertificates(req, res, next) {
  try {
    return res.json({ success: true, data: await getMyCertificates(req.user.sub), message: 'Your certificates loaded' });
  } catch (error) {
    return next(error);
  }
}

export async function downloadMyCertificateFile(req, res, next) {
  try {
    const certificate = await downloadMyCertificate(req.user.sub, req.params.certificateId);
    return res.download(certificate.filePath, certificate.fileName, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyVolunteerProfile(req, res, next) {
  try {
    const profile = await updateVolunteerProfile(req.user.sub, req.body);
    return res.json({ success: true, data: profile, message: 'Volunteer profile updated successfully' });
  } catch (error) {
    return next(error);
  }
}
