import { useCallback, useEffect, useState, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Home, Building2, Clock, Navigation } from "lucide-react";
import { Loader2 } from "lucide-react";

interface RouteMapProps {
  patientAddress: string;
  patientName: string;
  clinicAddress: string;
  clinicName: string;
  distance?: number; // in miles
}

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function RouteMap({
  patientAddress,
  patientName,
  clinicAddress,
  clinicName,
  distance,
}: RouteMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Calculate route when addresses change
  useEffect(() => {
    if (!isLoaded || !patientAddress || !clinicAddress) return;

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: patientAddress,
        destination: clinicAddress,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);

          // Extract route info
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || `${distance?.toFixed(1) || "?"} miles`,
              duration: leg.duration?.text || "Unknown",
            });
          }
        } else {
          console.error("Directions request failed:", status);
          // Use provided distance as fallback
          if (distance) {
            setRouteInfo({
              distance: `${distance.toFixed(1)} miles`,
              duration: `~${Math.round(distance * 3)} min drive`,
            });
          }
        }
      }
    );
  }, [isLoaded, patientAddress, clinicAddress, distance]);

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Route Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Failed to load Google Maps</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Route Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Route Map
          </span>
          {routeInfo && (
            <span className="text-sm font-normal text-gray-600 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Navigation className="h-4 w-4" />
                {routeInfo.distance}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {routeInfo.duration}
              </span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Route info bar */}
        <div className="px-4 pb-3 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <Home className="h-4 w-4 text-green-600" />
            <span className="text-gray-700">{patientName}'s Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <Building2 className="h-4 w-4 text-red-600" />
            <span className="text-gray-700">{clinicName}</span>
          </div>
        </div>

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={13}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
            ],
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: "#3B82F6",
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                },
              }}
            />
          )}

          {/* Patient marker - Green */}
          {directions && directions.routes[0]?.legs[0]?.start_location && (
            <Marker
              position={directions.routes[0].legs[0].start_location}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#22C55E",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 3,
              }}
              title={`${patientName}'s Location`}
            />
          )}

          {/* Clinic marker - Red */}
          {directions && directions.routes[0]?.legs[0]?.end_location && (
            <Marker
              position={directions.routes[0].legs[0].end_location}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#EF4444",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 3,
              }}
              title={clinicName}
            />
          )}
        </GoogleMap>

        {/* Bottom info bar */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Pickup</p>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <Home className="h-4 w-4 text-green-600" />
                {patientAddress || "Address not provided"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Destination</p>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-red-600" />
                {clinicAddress}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
