#!/usr/bin/env python3
"""Builds the city list for the Weather options: countries with their larger cities and exact coordinates from Open-Meteo's geocoding service (free, no key).
Writes tools/cities.json (kept in the repo, so this only needs re-running to change the list). apply_places.py turns it into src/config/cities.ts."""
import json, os, time, urllib.parse, urllib.request
OUT = os.path.expanduser('~/Developer/webos-launcher-tvos/tools/cities.json')
C = {
 'PK': ('Pakistan', ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad']),
 'IN': ('India', ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Nagpur']),
 'AE': ('United Arab Emirates', ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain']),
 'SA': ('Saudi Arabia', ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam']),
 'QA': ('Qatar', ['Doha']), 'KW': ('Kuwait', ['Kuwait City']), 'BH': ('Bahrain', ['Manama']), 'OM': ('Oman', ['Muscat']),
 'TR': ('Turkey', ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya']),
 'EG': ('Egypt', ['Cairo', 'Alexandria', 'Giza']), 'MA': ('Morocco', ['Casablanca', 'Rabat', 'Marrakesh']), 'DZ': ('Algeria', ['Algiers', 'Oran']),
 'TN': ('Tunisia', ['Tunis']), 'JO': ('Jordan', ['Amman']), 'LB': ('Lebanon', ['Beirut']), 'IQ': ('Iraq', ['Baghdad', 'Basra']),
 'BD': ('Bangladesh', ['Dhaka', 'Chittagong']), 'LK': ('Sri Lanka', ['Colombo']), 'NP': ('Nepal', ['Kathmandu']),
 'ID': ('Indonesia', ['Jakarta', 'Surabaya', 'Bandung']), 'MY': ('Malaysia', ['Kuala Lumpur', 'George Town']), 'SG': ('Singapore', ['Singapore']),
 'TH': ('Thailand', ['Bangkok', 'Chiang Mai']), 'VN': ('Vietnam', ['Hanoi', 'Ho Chi Minh City']), 'PH': ('Philippines', ['Manila', 'Cebu City']),
 'JP': ('Japan', ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya', 'Sapporo']), 'KR': ('South Korea', ['Seoul', 'Busan']), 'CN': ('China', ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu']),
 'HK': ('Hong Kong', ['Hong Kong']),
 'GB': ('United Kingdom', ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Leeds', 'Liverpool', 'Edinburgh', 'Bristol', 'Cardiff']),
 'IE': ('Ireland', ['Dublin', 'Cork']),
 'DE': ('Germany', ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf']),
 'FR': ('France', ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice']),
 'ES': ('Spain', ['Madrid', 'Barcelona', 'Valencia', 'Seville']), 'PT': ('Portugal', ['Lisbon', 'Porto']),
 'IT': ('Italy', ['Rome', 'Milan', 'Naples', 'Turin', 'Florence']),
 'NL': ('Netherlands', ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht']), 'BE': ('Belgium', ['Brussels', 'Antwerp']),
 'CH': ('Switzerland', ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne']), 'AT': ('Austria', ['Vienna', 'Graz', 'Salzburg']),
 'SE': ('Sweden', ['Stockholm', 'Gothenburg']), 'NO': ('Norway', ['Oslo', 'Bergen']), 'DK': ('Denmark', ['Copenhagen']), 'FI': ('Finland', ['Helsinki']),
 'PL': ('Poland', ['Warsaw', 'Krakow']), 'GR': ('Greece', ['Athens', 'Thessaloniki']), 'RU': ('Russia', ['Moscow', 'Saint Petersburg']),
 'AL': ('Albania', ['Tirana', 'Durres']), 'XK': ('Kosovo', ['Pristina']), 'BA': ('Bosnia and Herzegovina', ['Sarajevo']),
 'US': ('United States', ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Francisco', 'Seattle', 'Miami', 'Dallas']),
 'CA': ('Canada', ['Toronto', 'Vancouver', 'Montreal', 'Calgary']), 'MX': ('Mexico', ['Mexico City', 'Guadalajara']),
 'BR': ('Brazil', ['São Paulo', 'Rio de Janeiro']), 'AR': ('Argentina', ['Buenos Aires']), 'CO': ('Colombia', ['Bogotá']),
 'AU': ('Australia', ['Sydney', 'Melbourne', 'Brisbane', 'Perth']), 'NZ': ('New Zealand', ['Auckland', 'Wellington']),
 'ZA': ('South Africa', ['Johannesburg', 'Cape Town', 'Durban']), 'NG': ('Nigeria', ['Lagos', 'Abuja']), 'KE': ('Kenya', ['Nairobi']),
}
out = []
for cc, (cname, names) in C.items():
    cities = []
    for n in names:
        url = 'https://geocoding-api.open-meteo.com/v1/search?' + urllib.parse.urlencode({'name': n, 'count': 1, 'countryCode': cc})
        try:
            r = json.load(urllib.request.urlopen(url, timeout=15)).get('results') or []
        except Exception as e:
            print('fail', n, e); continue
        if r: cities.append({'name': n, 'lat': round(r[0]['latitude'], 2), 'lon': round(r[0]['longitude'], 2)})
        else: print('no result', n, cc)
        time.sleep(0.15)
    if cities: out.append({'code': cc, 'name': cname, 'cities': cities})
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(out), 'countries', sum(len(c['cities']) for c in out), 'cities')
