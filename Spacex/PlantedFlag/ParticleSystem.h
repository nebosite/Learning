// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#pragma once
#include "PointerDictionary.h"
#include "Fast3DObject.h"

//------------------------------------------------------------------------
// Particle - element of point mass in a particle system
//------------------------------------------------------------------------
class Particle
{
public:
	double mass;
	double perlinFactor;
	FastVector position;
	FastVector velocity;
	FastVector force;
	FastVector acceleration;
	FastVector dpdt;

	Particle();
	~Particle();

	Particle *Clone();
	void SetDerivatives();
};

//------------------------------------------------------------------------
// Spring - Spring descriptor for particle system
//------------------------------------------------------------------------
class Spring
{
public:
	Particle *from;
	Particle *to;
	double springconstant = 6.1f;
	double dampingconstant = 0.02f;
	double restlength = 1.6f;


	Spring(Particle *from, Particle *to);
	~Spring();

	Spring *Clone(PointerDictionary *particleDictionary);
};


//------------------------------------------------------------------------
// ParticleSystem - system for solving nBody particle systems
//------------------------------------------------------------------------
class ParticleSystem
{

	FastVector **_worldPoints;
	int _worldPointCount;

	PointerDictionary _particleDictionary;

public:
	double Drag;
	FastVector Gravity;
	FastVector Wind;
	double Turbulence;

	Particle **_particles;
	int _particleCount;
	Spring ** _springs;
	int _springCount;

	ParticleSystem();
	~ParticleSystem();

	void AddSpring(Spring *spring);
	void AddParticle(Particle *);
	FastVector** WorldPoints();
	void CalculateForces(double currentTime);
	void SetParticlePostion(int id, FastVector &position);

	ParticleSystem *Clone();

	static void Update_Euler(ParticleSystem *system, double dt, double currentTime);
	static void Update_Midpoint(ParticleSystem *system, double dt, double currentTime);

};

