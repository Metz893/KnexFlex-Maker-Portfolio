# KnexFlex-Maker-Portfolio

# KnexFlex — Gait Analysis Website
**Developed by Andrew Metz**

This website is part of KnexFlex, a wearable knee-motion tracking system I developed to help analyze gait patterns during rehabilitation. The platform processes recorded knee-angle data, calculates movement metrics, and allows users to visualize and compare gait cycles.

## Where to Look

For MIT Maker Portfolio reviewers, I recommend focusing on these files:

**1. [`lib/gaitAnalysis.ts`](lib/gaitAnalysis.ts) — Main Gait Analysis Algorithm**

The most important file. Contains my algorithm for detecting individual walking gait cycles, filtering irregular measurements, normalizing cycles, and calculating an average gait pattern.

**2. [`lib/sprintGaitAnalysis.ts`](lib/sprintGaitAnalysis.ts) — Sprinting Analysis**

A separate algorithm designed to detect and analyze gait cycles during sprinting.

**3. [`lib/gaitSimilarity.ts`](lib/gaitSimilarity.ts) — Gait Comparison**

Contains mathematical methods for aligning and comparing gait cycles, including root mean square error (RMSE) calculations.

**4. [`lib/analytics.ts`](lib/analytics.ts) and [`lib/analyticsPro.ts`](lib/analyticsPro.ts) — Movement Metrics**

Calculates range of motion, angular velocity, acceleration, and other movement measurements.

**5. [`app/online/gait-lab/page.tsx`](app/online/gait-lab/page.tsx) — Gait Visualization**

Connects the analysis algorithms to the website's interactive gait graphs.

## Technology

- Next.js, React, and TypeScript
- Firebase for data storage
- Recharts for data visualization
- Custom algorithms for gait analysis


## Project Goal

I developed KnexFlex after experiencing ACL injuries and wanting to make gait analysis more accessible and affordable. This website connects the device's measurements to tools for understanding knee movement and tracking changes over time.

**Recommended starting point: `lib/gaitAnalysis.ts`**
