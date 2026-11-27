"use client";

import dynamic from "next/dynamic";

const Estimator = dynamic(() => import("../estimator"));

export default Estimator;
