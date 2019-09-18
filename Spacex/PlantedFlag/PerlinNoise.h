// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#pragma once

#include "math.h"

//------------------------------------------------------------------------
// A static class for generating 3D noise
//------------------------------------------------------------------------
class PerlinNoise
{
	static int noiseWidth;
	static int noiseHeight;
	static int noiseDepth;

public:

	static double Noise3D(int x, int y, int z);
	static double InterpolatedNoise_3D(double x, double y, double z);
	static double PerlinNoise_3D(double x, double y, double z);
};