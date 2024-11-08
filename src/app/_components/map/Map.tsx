"use client"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';

function ChangeView({ center, zoom }: { center: LatLngTuple; zoom: number }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

export function Map({
    center,
    location = 'My Location',
}: {
    center: LatLngTuple;
    location?: string;
}) {
    return (
        <div className="absolute w-full h-full">
            <MapContainer
                center={center}
                zoom={11}
                scrollWheelZoom={false}
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full"
            >
                <ChangeView center={center} zoom={11} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={center}>
                    <Popup>{location}</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}

export default Map;