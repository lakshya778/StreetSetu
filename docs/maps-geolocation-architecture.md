# Maps and Geolocation Module Architecture

## Purpose

Design a backend-friendly and frontend-ready geolocation and maps layer for StreetSetu complaint visibility, issue heatmap generation, location capture, and status-aware map rendering.

## Scope

This document is architecture and interface-only. It does not implement frontend rendering or map UI logic.

## Core Capabilities

1. Complaint markers
2. Status color mapping
3. Heatmap layer generation
4. GPS coordinate capture and validation

## Domain Objects

### ComplaintMarker

```ts
interface ComplaintMarker {
  complaintId: string;
  title: string;
  status: 'submitted' | 'reviewed' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  latitude: number;
  longitude: number;
  wardId: string;
  neighbourhoodId?: string;
  departmentId?: string;
  markerColor: string;
  updatedAt: string;
}
```

### StatusColorMap

```ts
interface StatusColorMap {
  submitted: '#A0AEC0';
  reviewed: '#63B3ED';
  assigned: '#B794F4';
  in_progress: '#F6AD55';
  resolved: '#68D391';
  rejected: '#FC8181';
  escalated: '#F56565';
}
```

### HeatmapPoint

```ts
interface HeatmapPoint {
  complaintId: string;
  latitude: number;
  longitude: number;
  weight: number;
  status: string;
  category: string;
}
```

### GPSCapturePayload

```ts
interface GPSCapturePayload {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
  source: 'gps' | 'manual' | 'geojson' | 'map_select';
}
```

## Service Interfaces

### IMapService

```ts
interface IMapService {
  listMarkers(filters: MarkerFilter): Promise<ComplaintMarker[]>;
  buildHeatmapLayer(filters: HeatmapFilter): Promise<HeatmapPoint[]>;
  getComplaintSnapshot(complaintId: string): Promise<ComplaintMarker | null>;
}
```

### IGeolocationService

```ts
interface IGeolocationService {
  captureGPS(payload: GPSCapturePayload): Promise<{ latitude: number; longitude: number; accuracyMeters?: number }>;
  validateCoordinate(latitude: number, longitude: number): boolean;
  convertAddressToCoordinate(address: string): Promise<{ latitude: number; longitude: number }>;
}
```

## API Contracts

### GET /api/v1/maps/markers

Request:

```json
{
  "wardId": "string",
  "departmentId": "string",
  "status": "submitted",
  "category": "water"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "markers": []
  },
  "message": "Markers retrieved successfully",
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601 date"
  }
}
```

### GET /api/v1/maps/heatmap

Request:

```json
{
  "wardId": "string",
  "category": "water",
  "status": "in_progress",
  "timeWindowDays": 30
}
```

### POST /api/v1/geo/gps-capture

Request:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "accuracyMeters": 15,
  "capturedAt": "2026-09-15T10:00:00Z",
  "source": "gps"
}
```

## Data Flow

1. Complaints are created with a complaint body and location payload.
2. Complaint location data is normalized into a GeoJSON-compatible coordinate pair for storage.
3. The map service reads complaint location metadata and status metadata.
4. A heatmap layer is computed from complaint points and weighted by frequency or severity.
5. GPS capture data is validated before location metadata is attached to the complaint.

## Architectural Constraints

1. Map rendering must remain a frontend concern and must not be implemented in API business modules.
2. The API must expose only normalized map marker and geolocation interfaces, not UI-specific map libraries.
3. GPS capture must support both GPS and manual map-select source records.
4. All location data must preserve complaint metadata such as status, department, ward, and category.
5. Heatmap generation must never bypass complaint access controls and visibility rules.
6. Status colors must be consistent across API responses and UI design tokens.

## Validation Rules

- Latitude must be between -90 and 90.
- Longitude must be between -180 and 180.
- Coordinates must be valid decimal coordinate pairs.
- Marker and heatmap payloads must include complaint ID and status context.
- GPS capture source must be one of `gps`, `manual`, `geojson`, or `map_select`.

## Interfaces to Export

```ts
export type ComplaintStatus = 'submitted' | 'reviewed' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'escalated';

export interface ComplaintMarker {
  complaintId: string;
  title: string;
  status: ComplaintStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  latitude: number;
  longitude: number;
  wardId: string;
  neighbourhoodId?: string;
  departmentId?: string;
  markerColor: string;
  updatedAt: string;
}

export interface GPSCapturePayload {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
  source: 'gps' | 'manual' | 'geojson' | 'map_select';
}
```
