/**
 * @file src/constants.js
 * @description Domain constants, NAQI breakpoints, scientific constants, and messy datasets.
 */

/** Breakpoints for India National Air Quality Index (NAQI) in ug/m3 (CO in mg/m3) */
export const NAQI_BREAKPOINTS = {
  pm25: [
    { low: 0, high: 30, aqiLow: 0, aqiHigh: 50, label: 'Good', color: '#10b981' },
    { low: 31, high: 60, aqiLow: 51, aqiHigh: 100, label: 'Satisfactory', color: '#84cc16' },
    { low: 61, high: 90, aqiLow: 101, aqiHigh: 200, label: 'Moderate', color: '#eab308' },
    { low: 91, high: 120, aqiLow: 201, aqiHigh: 300, label: 'Poor', color: '#f97316' },
    { low: 121, high: 250, aqiLow: 301, aqiHigh: 400, label: 'Very Poor', color: '#ef4444' },
    { low: 251, high: 500, aqiLow: 401, aqiHigh: 500, label: 'Severe', color: '#7f1d1d' }
  ],
  pm10: [
    { low: 0, high: 50, aqiLow: 0, aqiHigh: 50, label: 'Good', color: '#10b981' },
    { low: 51, high: 100, aqiLow: 51, aqiHigh: 100, label: 'Satisfactory', color: '#84cc16' },
    { low: 101, high: 250, aqiLow: 101, aqiHigh: 200, label: 'Moderate', color: '#eab308' },
    { low: 251, high: 350, aqiLow: 201, aqiHigh: 300, label: 'Poor', color: '#f97316' },
    { low: 351, high: 430, aqiLow: 301, aqiHigh: 400, label: 'Very Poor', color: '#ef4444' },
    { low: 431, high: 600, aqiLow: 401, aqiHigh: 500, label: 'Severe', color: '#7f1d1d' }
  ],
  no2: [
    { low: 0, high: 40, aqiLow: 0, aqiHigh: 50, label: 'Good', color: '#10b981' },
    { low: 41, high: 80, aqiLow: 51, aqiHigh: 100, label: 'Satisfactory', color: '#84cc16' },
    { low: 81, high: 180, aqiLow: 101, aqiHigh: 200, label: 'Moderate', color: '#eab308' },
    { low: 181, high: 280, aqiLow: 201, aqiHigh: 300, label: 'Poor', color: '#f97316' },
    { low: 281, high: 400, aqiLow: 301, aqiHigh: 400, label: 'Very Poor', color: '#ef4444' }
  ],
  so2: [
    { low: 0, high: 40, aqiLow: 0, aqiHigh: 50, label: 'Good', color: '#10b981' },
    { low: 41, high: 80, aqiLow: 51, aqiHigh: 100, label: 'Satisfactory', color: '#84cc16' },
    { low: 81, high: 380, aqiLow: 101, aqiHigh: 200, label: 'Moderate', color: '#eab308' },
    { low: 381, high: 800, aqiLow: 201, aqiHigh: 300, label: 'Poor', color: '#f97316' }
  ]
};

/** Molecular conversion factors to standard ug/m3 at 25C and 1 atm */
export const GAS_TO_UGM3_FACTORS = {
  so2_ppm: 2620,
  no2_ppb: 1.88,
  no2_ppm: 1880,
  co_ppm: 1150,
  o3_ppb: 1.96,
  mgm3_to_ugm3: 1000
};

/** IIT Delhi Dispersed Source Remediation PM2.5 Reductions */
export const IIT_DELHI_REDUCTION_FACTORS = {
  pothole_unpaved_paving: { min: 0.150, max: 0.266, mean: 0.208, label: 'Road Paving & Pothole Stabilization' },
  waste_burning_patrols: { min: 0.120, max: 0.184, mean: 0.152, label: 'Zero Open Burning Strict Enforcement' },
  water_misting_mechanized: { min: 0.080, max: 0.142, mean: 0.111, label: 'Anti-Smog Mist Cannons & Vacuum Sweeping' },
  dg_set_diesel_halt: { min: 0.095, max: 0.160, mean: 0.127, label: 'Commercial DG Set Disconnection' }
};

/** EEA CleanAir@School diurnal traffic impact windows */
export const SCHOOL_DIURNAL_WINDOWS = {
  morning: { startHour: 8, endHour: 9.5, label: 'Morning Drop-off Surge' },
  afternoon: { startHour: 14.5, endHour: 16.5, label: 'Afternoon Pick-up Surge' }
};

/** EEA Citizen Sensor Physical Reliability Boundaries */
export const SENSOR_PHYSICS_THRESHOLDS = {
  humidity_optical_pm_bias: 80.0,
  temp_electrochemical_drift: 38.0,
  zscore_outlier_cutoff: 2.5,
  min_plausible_pm: 2.0,
  max_plausible_pm: 1200.0
};

/** Multilingual translations for citizen bulletins */
export const I18N_BULLETINS = {
  English: {
    title: 'Civic Air Quality Emergency Advisory',
    advisory: 'Air pollution levels exceed safe thresholds. Immediate preventative actions recommended.',
    vulnerableHeader: 'High-Risk Group Directives (Kids, Elderly, Respiratory):',
    kids: 'Suspend outdoor sports, assemblies, and early morning park playtime.',
    elderly: 'Remain indoors; avoid early morning/evening strolls; check oxygen saturation.',
    asthma: 'Keep rescue inhalers accessible at all times; use N95 respirators if transit is mandatory.'
  },
  Hindi: {
    title: 'सामुदायिक वायु गुणवत्ता एवं स्वास्थ्य चेतावनी',
    advisory: 'वायु प्रदूषण गंभीर स्तर पर पहुंच गया है। सभी नागरिकों से तत्काल सावधानी बरतने का अनुरोध है।',
    vulnerableHeader: 'अति-संवेदनशील वर्ग (बच्चे, बुजुर्ग, श्वास रोगी) हेतु सुरक्षा दिशानिर्देश:',
    kids: 'बच्चों के सभी बाहरी खेल और सुबह की प्रार्थना सभाएं तुरंत स्थगित करें।',
    elderly: 'वरिष्ठ नागरिक सुबह और शाम की सैर बंद करें तथा घर के भीतर ही रहें।',
    asthma: 'दमा और ब्रोंकाइटिस रोगी हर समय अपना आपातकालीन इनहेलर साथ रखें।'
  },
  Marathi: {
    title: 'स्थानिक हवा गुणवत्ता व आरोग्य सूचना पत्रक',
    advisory: 'हवेतील सूक्ष्म धुलिकणांचे प्रमाण धोकादायक पातळीवर पोहोचले आहे. खबरदारी घेणे आवश्यक आहे.',
    vulnerableHeader: 'जोखीम गटांसाठी (लहान मुले, ज्येष्ठ नागरिक, श्वसन रुग्ण) मार्गदर्शक सूचना:',
    kids: 'शाळांमधील मैदानी खेळ आणि सकाळच्या प्रार्थना तात्काळ बंद कराव्यात.',
    elderly: 'ज्येष्ठांनी पहाटेचे फिरणे टाळावे व फिल्टर असलेल्या खोलीत राहावे.',
    asthma: 'दमा असणाऱ्या नागरिकांनी निर्धारित इनहेलर सतत सोबत ठेवावे.'
  },
  Tamil: {
    title: 'சமூக காற்றுத் தரம் மற்றும் சுகாதார எச்சரிக்கை',
    advisory: 'காற்றின் தரம் அபாயகரமான அளவை எட்டியுள்ளது. பொதுமக்கள் விழிப்புடன் இருக்குமாறு கேட்டுக்கொள்ளப்படுகிறார்கள்.',
    vulnerableHeader: 'பாதிக்கப்படக்கூடிய குழுக்களுக்கான (குழந்தைகள், முதியவர்கள், ஆஸ்துமா நோயாளிகள்) வழிகாட்டுதல்கள்:',
    kids: 'குழந்தைகள் வெளிப்புற விளையாட்டுகள் மற்றும் உடற்பயிற்சிகளைத் தவிர்க்கவும்.',
    elderly: 'முதியவர்கள் காலை நடைப்பயிற்சியைத் தவிர்த்து வீட்டிற்குள்ளேயே இருக்கவும்.',
    asthma: 'ஆஸ்துமா நோயாளிகள் தங்களின் அவசர இன்ஹேலர்களை எப்போதும் கையில் வைத்திருக்கவும்.'
  },
  Bengali: {
    title: 'নাগরিক বায়ু মান ও জরুরি স্বাস্থ্য নির্দেশিকা',
    advisory: 'বায়ুদূষণের মাত্রা বিপজ্জনক পর্যায়ে পৌঁছেছে। সকল নাগরিককে সতর্ক থাকার অনুরোধ করা হচ্ছে।',
    vulnerableHeader: 'ঝুঁকিপূর্ণ গোষ্ঠীর (শিশু, প্রবীণ, শ্বাসকষ্টের রোগী) বিশেষ সতর্কতা:',
    kids: 'শিশুদের মাঠের খেলাধুলা এবং বাইরের কার্যক্রম স্থগিত রাখুন।',
    elderly: 'বয়স্ক ব্যক্তিরা সকালের হাঁটাচলা বন্ধ রাখুন এবং ঘরের ভেতরে থাকুন।',
    asthma: 'অ্যাজমা ও সিওপিডি রোগীরা সার্বক্ষণিক ইনহেলার সাথে রাখুন।'
  }
};

/** Pre-packaged Messy Real-World Civic Datasets */
export const SAMPLE_DATASETS = {
  snapshotA: {
    name: 'Current Shift: Mixed Ward Sensor Feed (Anomalies & Gaps)',
    description: 'Realistic telemetry containing missing readings, RH fog over-reads, and unit disparities.',
    raw: `Timestamp,Location,Sensor_Tag,Sensor_Type,PM2.5,PM10,NO2,Temp_C,RH_Pct,Status
2026-11-14 07:00,Ward-04 Anand Vihar Chowk,SEN-401,Regulatory_BAM,412 ug/m3,590 ug/m3,65 ppb,16,84,Active
2026-11-14 07:00,Ward-12 St Xavier School Gate,SEN-SCH-12,LowCost_Optical,385,480,0.082 ppm,15,88,Active
2026-11-14 07:00,Ward-09 Rosewood RWA Complex,SEN-901,LowCost_Optical,245 ug/m3,340 ug/m3,38 ppb,17,72,Active
2026-11-14 07:00,Ward-02 Metro Pier 14 Construction,SEN-M2,LowCost_Optical,110,880 ug/m3,-,18,65,Active
2026-11-14 07:30,Ward-12 St Xavier School Gate,SEN-SCH-12,LowCost_Optical,MISSING,MISSING,N/A,15,89,PACKET_LOSS
2026-11-14 08:00,Ward-04 Anand Vihar Chowk,SEN-401,Regulatory_BAM,485 ug/m3,680 ug/m3,82 ppb,17,81,Active
2026-11-14 08:00,Ward-12 St Xavier School Gate,SEN-SCH-12,LowCost_Optical,440,560,0.098 ppm,17,86,Active
2026-11-14 08:00,Ward-09 Rosewood RWA Complex,SEN-901,LowCost_Optical,280 ug/m3,390 ug/m3,42 ppb,18,69,Active
2026-11-14 08:30,Ward-18 Industrial Petro-Corridor,SEN-IND-18,Electrochemical,395,510,145 ppb,39.5,52,THERMAL_SPIKE
2026-11-14 08:30,Ward-02 Metro Pier 14 Construction,SEN-M2,LowCost_Optical,130,950 ug/m3,50 ppb,19,61,Active`
  },
  snapshotB: {
    name: 'Previous Baseline Shift (24h Prior Shift Reference)',
    description: 'Prior baseline used by the Delta Comparator to compute precise ward shifts.',
    raw: `Timestamp,Location,Sensor_Tag,Sensor_Type,PM2.5,PM10,NO2,Temp_C,RH_Pct,Status
2026-11-13 08:00,Ward-04 Anand Vihar Chowk,SEN-401,Regulatory_BAM,310 ug/m3,440 ug/m3,48 ppb,18,70,Active
2026-11-13 08:00,Ward-12 St Xavier School Gate,SEN-SCH-12,LowCost_Optical,185 ug/m3,260 ug/m3,0.045 ppm,18,72,Active
2026-11-13 08:00,Ward-09 Rosewood RWA Complex,SEN-901,LowCost_Optical,170 ug/m3,240 ug/m3,32 ppb,19,65,Active
2026-11-13 08:00,Ward-02 Metro Pier 14 Construction,SEN-M2,LowCost_Optical,95 ug/m3,540 ug/m3,40 ppb,20,58,Active
2026-11-13 08:00,Ward-18 Industrial Petro-Corridor,SEN-IND-18,Electrochemical,260 ug/m3,380 ug/m3,90 ppb,31,55,Active`
  }
};
