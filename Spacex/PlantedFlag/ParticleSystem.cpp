// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#include "stdafx.h"
#include "ParticleSystem.h"
#include "PerlinNoise.h"


//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
ParticleSystem::ParticleSystem()
{
	_particles = new Particle*[2000];
	_springs = new Spring*[2000];
	_particles[0] = NULL;
	_springs[0] = NULL;
	_worldPoints = new FastVector*[2000];
	_worldPoints[0] = NULL;
	_particleCount = 0;
	_springCount = 0;
	_worldPointCount = 0;

	Drag = 0.808;
	Gravity = FastVector(0, -10, 0);
}


//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
ParticleSystem::~ParticleSystem()
{
	delete _worldPoints;
    
	for (int i = 0; i < _springCount; i++)
	{
		delete _springs[i];
	}

	for (int i = 0; i < _particleCount; i++)
	{
		delete _particles[i];
	}
	delete _particles;
	delete _springs;
}

//------------------------------------------------------------------------
// WorldPoints - Locations of particles in world coordinates
//------------------------------------------------------------------------
FastVector **ParticleSystem::WorldPoints()
{
	return _worldPoints;
}

// 
//------------------------------------------------------------------------
// Update_Euler - Simple Euler step calculation
//------------------------------------------------------------------------
void ParticleSystem::Update_Euler(ParticleSystem *system, double dt, double currentTime)
{
	system->CalculateForces(currentTime);

	for (int i = 0; i < system->_particleCount; i++)
	{
		Particle *p = system->_particles[i];

		p->position += p->dpdt * dt;
		p->velocity += p->acceleration * dt;
	}
}


//------------------------------------------------------------------------
// Update_Midpoint - Runge Kutte second order ODE solver
//------------------------------------------------------------------------
void ParticleSystem::Update_Midpoint(ParticleSystem *system, double h, double currentTIme)
{
	ParticleSystem *k1 = system;
	ParticleSystem *k2 = system->Clone();

	// Calculate k1 forces
	k1->CalculateForces(currentTIme);

	// Calculate K2 forces
	for (int i = 0; i < system->_particleCount; i++)
	{
		Particle *k1p = k1->_particles[i];
		Particle *k2p = k2->_particles[i];

		k2p->position += k1p->dpdt * h / 2;
		k2p->velocity += k1p->acceleration * h / 2;
	}
	k2->CalculateForces(currentTIme + h / 2);

	// Update original system 
	for (int i = 0; i < system->_particleCount; i++)
	{
		Particle *p = system->_particles[i];
		Particle *k2p = k2->_particles[i];

		p->position += k2p->dpdt * h;
		p->velocity += k2p->acceleration * h;
	}

	delete k2;
}


//------------------------------------------------------------------------
// Clone
//------------------------------------------------------------------------
ParticleSystem *ParticleSystem::Clone()
{
	ParticleSystem *newSystem = new ParticleSystem();

	// Clone particles
	for (int i = 0; i < _particleCount; i++)
	{
		Particle *clonedParticle = _particles[i]->Clone();
		newSystem->AddParticle(clonedParticle);
		_particleDictionary.Set(_particles[i], clonedParticle);
	}

	// Clone Springs
	for (int i = 0; i < _springCount; i++)
	{
		newSystem->AddSpring(_springs[i]->Clone(&_particleDictionary));
	}

	// Clone other fields
	newSystem->Gravity = Gravity;
	newSystem->Drag = Drag;
	newSystem->Wind = Wind;
	newSystem->Turbulence = Turbulence;

	return newSystem;
}

//------------------------------------------------------------------------
// AddSpring (make sure you add the spring's particles first)
//------------------------------------------------------------------------
void ParticleSystem::AddSpring(Spring *spring)
{
	_springs[_springCount++] = spring;
	_springs[_springCount] = 0;

	_worldPoints[_worldPointCount++] = &(spring->from->position);
	_worldPoints[_worldPointCount++] = &(spring->to->position);
	_worldPoints[_worldPointCount] = 0;
}

//------------------------------------------------------------------------
// AddParticle
//------------------------------------------------------------------------
void ParticleSystem::AddParticle(Particle *particle)
{
	if (!_particleDictionary.Has(particle))
	{
		_particleDictionary.Set(particle, NULL);
		_particles[_particleCount++] = particle;
		_particles[_particleCount] = 0;
	}
}

//------------------------------------------------------------------------
// SetParticlePostion
//------------------------------------------------------------------------
void ParticleSystem::SetParticlePostion(int id, FastVector &position)
{
	_particles[id]->position = position;
}

//------------------------------------------------------------------------
// CalculateForces
//------------------------------------------------------------------------
void ParticleSystem::CalculateForces(double currentTime)
{

	// Prepare particles and apply viscous drag
	for (int i = 0; i < _particleCount; i++)
	{
		Particle *p = _particles[i];
		p->force = FastVector::Zero;
		p->force -= p->velocity *Drag;
	}

	// Calculate Spring forces
	for (int i = 0; i < _springCount; i++)
	{
		Spring *s = _springs[i];

		Particle *p1 = s->from;
		Particle *p2 = s->to;
		FastVector dp = p1->position - p2->position;
		double len = dp.GetLength();

		double a = s->springconstant * (len - s->restlength);
		dp.Normalize();
		FastVector springForce = dp * a;

		p1->force -= springForce;
		p2->force += springForce;
	}

	// Calculate other forces
	for (int i = 0; i < _particleCount; i++)
	{
		FastVector localTurbulence;

		localTurbulence.X = cos(_particles[i]->perlinFactor) * Turbulence;
		localTurbulence.Y = sin(_particles[i]->perlinFactor + .3) * Turbulence;
		localTurbulence.Z = sin(_particles[i]->perlinFactor) * Turbulence;

		FastVector turbulentWind = Wind + localTurbulence;
		_particles[i]->force += (turbulentWind)* Drag;
		_particles[i]->SetDerivatives();
		_particles[i]->acceleration += Gravity;
	}
}


// ******************************************************************************************
// ******************************************************************************************
// **************   SPRING        ***********************************************************
// ******************************************************************************************
// ******************************************************************************************
// ******************************************************************************************

//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
Spring::Spring(Particle *from, Particle *to)
{
	this->from = from;
	this->to = to;

	springconstant = 600.0;
	dampingconstant = 0.02;
	restlength = 1.6;
}

//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
Spring::~Spring()
{
}

//------------------------------------------------------------------------
// Clone - The dictionary values contain references to the cloned versions
// of the points this spring is attached to
//------------------------------------------------------------------------
Spring *Spring::Clone(PointerDictionary *particleDictionary)
{
	Spring *newSpring = new Spring(
		(Particle *)particleDictionary->Get(from),
		(Particle *)particleDictionary->Get(to));

	newSpring->springconstant = springconstant;
	newSpring->dampingconstant = dampingconstant;
	newSpring->restlength = restlength;
	return newSpring;
}

// ******************************************************************************************
// ******************************************************************************************
// **************   PARTICLE      ***********************************************************
// ******************************************************************************************
// ******************************************************************************************
// ******************************************************************************************

//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
Particle::Particle()
{
	mass = 1;
}

//------------------------------------------------------------------------
// Desctructor
//------------------------------------------------------------------------
Particle::~Particle()
{
}

//------------------------------------------------------------------------
// Clone
//------------------------------------------------------------------------
Particle *Particle::Clone()
{
	Particle *newParticle = new Particle();
	newParticle->mass = mass;
	newParticle->position = position;
	newParticle->velocity = velocity;
	newParticle->force = force;
	newParticle->acceleration = acceleration;
	newParticle->dpdt = dpdt;
	newParticle->perlinFactor = perlinFactor;
	return newParticle;
}

//------------------------------------------------------------------------
// SetDerivatives - set postion rate of change and acceleration
//------------------------------------------------------------------------
void Particle::SetDerivatives()
{
	dpdt = velocity;
	acceleration = force / mass;
}

