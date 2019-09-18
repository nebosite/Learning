// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#include "stdafx.h"
#include "PerlinNoise.h"


int PerlinNoise::noiseWidth = 2000;
int PerlinNoise::noiseHeight = 2000;
int PerlinNoise::noiseDepth = 2000;


//------------------------------------------------------------------------
// Noise3D - This is the heart of the Perlin noise generator - it can 
// predictably create large high-quality pseudo-random numbers.
//------------------------------------------------------------------------
double PerlinNoise::Noise3D(int x, int y, int z)
{
	int v = x + y * 57 + z * 3461;
	unsigned long n = (unsigned long)(v > 0 ? v : -v);
	n = ((n << 13) ^ n) & 0xffffffff;
	unsigned long factor = (((n * n) & 0xffffffff) * 15731 + 789221) & 0xffffffff;
	double noise = ((n * (factor)+1376312589) & 0xffffffff) / 4294967295.0;

	return noise;
}

//------------------------------------------------------------------------
// InterpolatedNoise_3D - Perlin noise interpolation
//------------------------------------------------------------------------
double PerlinNoise::InterpolatedNoise_3D(double x, double y, double z)
{

	// normalize negative components
	if (x < 0) x += ((int)(x / noiseWidth) - 1) * -noiseWidth;
	if (y < 0) y += ((int)(y / noiseHeight) - 1) * -noiseHeight;
	if (z < 0) z += ((int)(z / noiseDepth) - 1) * -noiseDepth;

	//get fractional part of x and y
	double fractX = (x)-(int)(x);
	double fractY = (y)-(int)(y);
	double fractZ = (z)-(int)(z);

	//wrap around
	int x1 = ((int)(x)+noiseWidth) % noiseWidth;
	int y1 = ((int)(y)+noiseHeight) % noiseHeight;
	int z1 = ((int)(z)+noiseDepth) % noiseDepth;

	//neighbor values
	int x2 = (x1 + noiseWidth - 1) % noiseWidth;
	int y2 = (y1 + noiseHeight - 1) % noiseHeight;
	int z2 = (z1 + noiseDepth - 1) % noiseDepth;

	//smooth the noise with bilinear interpolation
	double value = 0.0;
	value += fractX * fractY * fractZ * Noise3D(x1, y1, z1);
	value += fractX * (1 - fractY) * fractZ * Noise3D(x1, y2, z1);
	value += (1 - fractX) * fractY * fractZ * Noise3D(x2, y1, z1);
	value += (1 - fractX) * (1 - fractY) * fractZ * Noise3D(x2, y2, z1);

	value += fractX * fractY * (1 - fractZ) * Noise3D(x1, y1, z2);
	value += fractX * (1 - fractY) * (1 - fractZ) * Noise3D(x1, y2, z2);
	value += (1 - fractX) * fractY * (1 - fractZ) * Noise3D(x2, y1, z2);
	value += (1 - fractX) * (1 - fractY) * (1 - fractZ) * Noise3D(x2, y2, z2);

	return value;
}


//------------------------------------------------------------------------
// PerlinNoise_3D - output a random perlin noise value from 0 to 1 based 
// on a 3D location.
//------------------------------------------------------------------------
double PerlinNoise::PerlinNoise_3D(double x, double y, double z)
{
	double total = 0;
	double persistence = 0.5;
	int octaves = 6;

	for (int i = 0; i < octaves; i++)
	{
		double frequency = 1 << i;
		double amplitude = pow(persistence, i);
		double noise = InterpolatedNoise_3D(x * frequency, y * frequency, z * frequency);
		total += noise * amplitude;
	}
	total -= 0.45;
	if (total < 0) total = 0;
	if (total > 1.0) total = 1.0;
	return total;
}