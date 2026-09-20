/**
 * Fakta om selve eiendommen og eieren — IKKE forretningsregler (de ligger i
 * lib/config.ts). Dette er stedet å endre først når løsningen tas i bruk for
 * en annen hytte: navn, sted, kontaktinfo og kapasitet samles her i stedet
 * for å ligge hardkodet spredt i komponentene.
 */

export const PROPERTY_NAME = "Lindeview";
export const LOCATION_LABEL = "Hillestadheia";
/** Søketekst brukt i det innebygde Google Maps-kartet i footeren. */
export const MAP_QUERY = "Lindeknuten";
/** Kort, stabil lenke til oppføringen — Airbnb sine søke-/sesjonsparametre (check_in, source_impression_id o.l.) er ikke nødvendige for at lenken skal virke. */
export const AIRBNB_URL = "https://www.airbnb.no/rooms/942451723603454434";

export const OWNER_NAME = "Morten Ljøstad";
/** Mottar e-postvarsel om nye bookingforespørsler og betalingsproblemer. */
export const OWNER_EMAIL = "ljoestad@gmail.com";
export const OWNER_PHONE_DISPLAY = "+47 90 59 18 20";
/** Samme nummer, uten mellomrom — for tel:/Resend-avsenderadresse o.l. */
export const OWNER_PHONE_TEL = "+4790591820";
export const CONTACT_EMAIL = "post@lindeview.no";

export const GUEST_CAPACITY = 10;
export const BEDROOMS = 4;
export const BATHROOMS = 2;
