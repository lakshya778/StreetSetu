function identityId(identity) {
  const id = identity?._id || identity;
  return id == null ? null : String(id);
}

export function redactComplaintReporter(complaint, req) {
  if (!complaint) return complaint;
  const result = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  const creatorId = identityId(result.createdBy);
  const viewerId = identityId(req?.user?.sub);
  const mayViewIdentity = ['admin', 'officer'].includes(req?.user?.role) || Boolean(creatorId && creatorId === viewerId);
  if (mayViewIdentity) return result;

  const label = result.isAnonymous ? 'Anonymous' : 'Reporter';
  if (result.createdBy) result.createdBy = { name: label };
  if (result.rejectedBy && identityId(result.rejectedBy) === creatorId) result.rejectedBy = { name: label };
  if (Array.isArray(result.statusHistory)) {
    result.statusHistory = result.statusHistory.map((event) => (
      identityId(event.changedBy) === creatorId ? { ...event, changedBy: { name: label } } : event
    ));
  }
  return result;
}

export function redactAssignmentReporters(assignments, req) {
  return assignments.map((assignment) => {
    const result = typeof assignment.toObject === 'function' ? assignment.toObject() : { ...assignment };
    if (result.complaint) result.complaint = redactComplaintReporter(result.complaint, req);
    return result;
  });
}
