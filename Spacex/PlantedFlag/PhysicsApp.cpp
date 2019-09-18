// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------


#include "stdafx.h"
#include "PhysicsApp.h"
#include "ParticleSystem.h"
#include "PerlinNoise.h"
#include "Fast3DObject.h"

#define _USE_MATH_DEFINES
#include "math.h"


//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
PhysicsApp::PhysicsApp()
{
	_graphics = new ConsoleGraphics(100, 60);
	particleSystem = NULL;
}


//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
PhysicsApp::~PhysicsApp()
{
	delete _graphics;
}


//------------------------------------------------------------------------
// DrawLineSegments Special handler to draw line segments from FastVectors
//------------------------------------------------------------------------
void PhysicsApp::DrawLineSegments(FastVector** points, char c, int attribute)
{
	for (int i = 0; points[i] != 0; i += 2)
	{
		FastVector p1 = *points[i];
		FastVector p2 = *points[i + 1];
		if (c == '.' && (p1.Z > 5 || p2.Z > 5)) continue;
		_graphics->DrawLine(
			_graphics->Width / 2 + p1.X, _graphics->Height / 2 - p1.Y,
			_graphics->Width / 2 + p2.X, _graphics->Height / 2 - p2.Y, c, attribute);
	}
}

//------------------------------------------------------------------------
// MakeFlag - Generate the particles and springs for the flag
//------------------------------------------------------------------------
ParticleSystem *MakeFlag(FastVector top, FastVector bottom, const int xpoints, const int ypoints)
{
	ParticleSystem *particleSystem = new ParticleSystem();
	particleSystem->Gravity = FastVector(0, -800, 0);
	particleSystem->Drag = .15;
	particleSystem->Wind = FastVector(-20, 0, 0);
	particleSystem->Turbulence = 160;
	double particleMass = .01;
	double springConstant = 400;
	double height = (top - bottom).GetLength();
	double length = height * 2;
	double skip = length / xpoints;

	Particle **particles = (Particle **)calloc(xpoints * ypoints, sizeof(Particle *));



	Particle *lastParticle = new Particle();
	lastParticle->position = top;
	lastParticle->mass = particleMass;
	for (int j = 0; j < ypoints; j++)
	{
		for (int i = 0; i < xpoints; i++)
		{
			Particle *nextParticle = new Particle();
			nextParticle->mass = particleMass;
			nextParticle->position = top;

			nextParticle->position.X += skip * i;
			nextParticle->position.Y -= skip * j;
			particles[i + j * xpoints] = nextParticle;
			particleSystem->AddParticle(nextParticle);
		}
	}

	for (int i = 0; i < xpoints; i++)
	{
		for (int j = 0; j < ypoints; j++)
		{
			if (i < xpoints - 1)
			{
				Spring *newSpring = new Spring(particles[i + j * xpoints], particles[i + 1 + j * xpoints]);
				newSpring->restlength = skip;
				newSpring->springconstant = springConstant;
				particleSystem->AddSpring(newSpring);
			}
			if (j < ypoints - 1)
			{
				Spring *newSpring = new Spring(particles[i + j * xpoints], particles[i + (j + 1) * xpoints]);
				newSpring->restlength = skip;
				newSpring->springconstant = springConstant;
				particleSystem->AddSpring(newSpring);
			}

		}
	}

	return particleSystem;
}

//------------------------------------------------------------------------
// Interpolate - get a point midway between two other points
//------------------------------------------------------------------------
FastVector Interpolate(FastVector a, FastVector b, double fraction)
{
	return a + ((b - a) * fraction);
}

//------------------------------------------------------------------------
// SetupWidgets
//------------------------------------------------------------------------
void PhysicsApp::SetupWidgets()
{
	mainControl = new Widget(0, 0, _graphics->Width, _graphics->Height);
	_graphics->AddWidget(mainControl);
	
	flagBaseControl = new Widget(0, 0, 12, 12);
	_graphics->AddWidget(flagBaseControl);

	windSlider = new SliderWidget(2, _graphics->Height - 4, 22, 2, "Wind", 0, 100);
	_graphics->AddWidget(windSlider);
	windSlider->SetValue(30);

	gravitySlider = new SliderWidget(2, _graphics->Height - 7, 22, 2, "Gravity", 0, 2000);
	_graphics->AddWidget(gravitySlider);
	gravitySlider->SetValue(800);

	springConstantSlider = new SliderWidget(2, _graphics->Height - 10, 22, 2, "Spring Constant", 5, 200);
	_graphics->AddWidget(springConstantSlider);
	springConstantSlider->SetValue(150);

	dragSlider = new SliderWidget(2, _graphics->Height - 13, 22, 2, "Drag", 0, 100);
	_graphics->AddWidget(dragSlider);
	dragSlider->SetValue(15);

	turbulenceSlider = new SliderWidget(2, _graphics->Height - 16, 22, 2, "Turbulence", 0, 20);
	_graphics->AddWidget(turbulenceSlider);
	turbulenceSlider->SetValue(8);
}

//------------------------------------------------------------------------
// SetupBallpoints - Add points in the shape of a sphere
//------------------------------------------------------------------------
void SetupBallpoints(Fast3DOjbect *flagBase)
{
	const int latitudes = 5;
	const int longitudes = 6;
	double phiStart = .4;
	double phiSkip = (M_PI - phiStart * 2) / (latitudes - 1);
	double betaSkip = (M_PI * 2) / longitudes;
	FastVector spherePoints[longitudes][latitudes];
	for (int latitude = 0; latitude < latitudes; latitude++)
	{
		double phi = latitude *phiSkip + phiStart;
		double y = cos(phi);
		double r = sin(phi);
		for (int longitude = 0; longitude < longitudes; longitude++)
		{
			double beta = longitude * betaSkip;
			double x = cos(beta) * r;
			double z = sin(beta) * r;

			spherePoints[longitude][latitude].X = x;
			spherePoints[longitude][latitude].Y = y;
			spherePoints[longitude][latitude].Z = z;
			spherePoints[longitude][latitude].W = 1;
		}
	}

	for (int latitude = 0; latitude < latitudes; latitude++)
	{
		for (int longitude = 0; longitude < longitudes; longitude++)
		{
			flagBase->AddPoint(spherePoints[longitude][latitude]);
			flagBase->AddPoint(spherePoints[(longitude + 1) % longitudes][latitude]);
			if (latitude < latitudes - 1)
			{
				flagBase->AddPoint(spherePoints[longitude][latitude]);
				flagBase->AddPoint(spherePoints[longitude][latitude + 1]);

			}
		}
	}

}

//------------------------------------------------------------------------
// Run - start the app here
//------------------------------------------------------------------------
void PhysicsApp::Run()
{
	char buffer[1000];
	
	SetupWidgets();

	Fast3DOjbect flagBase;
	SetupBallpoints(&flagBase);

	Fast3DOjbect flagPole;
	flagPole.AddPoint(0, 1, 0);
	flagPole.AddPoint(0, 3, 0);

	int xpoints = 6;
	int ypoints = 4;
	int frame = 0;
	double theta = 0;
	double upsilon = 0;
	double flagBasex = 0, flagBasey = -13;
	int subSteps = 60;
	FastVector flagTop, flagBottom;
	FastVector lastTop, lastBottom;
	bool firstTime = true;
	double currentTime = 0;

	// Main Loop
	while (true)
	{
		// **** MOUSE HANDLING ****
		for (int i = 0; i < mainControl->DragCount; i++)
		{
			upsilon -= (0.1) * mainControl->Drags[i].DY;
			theta -= (0.1) * mainControl->Drags[i].DX;
		}
		for (int i = 0; i < flagBaseControl->DragCount; i++)
		{
			flagBasey -= flagBaseControl->Drags[i].DY;
			flagBasex += flagBaseControl->Drags[i].DX;
		}
		flagBaseControl->X = flagBasex - flagBaseControl->Width / 2 + _graphics->Width / 2;
		flagBaseControl->Y = _graphics->Height / 2 - (flagBasey + flagBaseControl->Height / 2);

		mainControl->DragCount = 0;
		flagBaseControl->DragCount = 0;

		// **** TRANSFORM 3D OBJECTS ****

		FastTransformMatrix flagBaseTransform =
			FastTransformMatrix::TranslateMatrix(flagBasex, flagBasey, 0)
			* FastTransformMatrix::ScaleMatrix(10)
			* FastTransformMatrix::RotateXMatrix(upsilon)
			* FastTransformMatrix::RotateZMatrix(theta)
			;

		flagBase.SetTransformation(flagBaseTransform);
		flagPole.SetTransformation(flagBaseTransform);
		FastVector **flagBaseWorldPoints = flagBase.WorldPoints();
		FastVector **flagPoleWorldPoints = flagPole.WorldPoints();
		flagTop = *(flagPoleWorldPoints[1]);
		flagBottom = Interpolate(*(flagPoleWorldPoints[1]), *(flagPoleWorldPoints[0]), .7);
		if (firstTime)
		{
			firstTime = false;
			lastTop = flagTop;
			lastBottom = flagBottom;
		}

		// **** Initialize Particle system ****

		if (particleSystem == NULL) particleSystem = MakeFlag(flagTop, flagBottom, xpoints, ypoints);
		
		// **** Change physics settings based on the slider control values ****

		particleSystem->Wind = FastVector(-windSlider->GetValue(), 0, 0);
		particleSystem->Turbulence = windSlider->GetValue() * turbulenceSlider->GetValue();
		particleSystem->Gravity = FastVector(0, -gravitySlider->GetValue(), 0);
		particleSystem->Drag = dragSlider->GetValue() / 100.0;
		int springConstant = springConstantSlider->GetValue();
		for (int i = 0; i < particleSystem->_springCount; i++)
		{
			particleSystem->_springs[i]->springconstant = springConstant;
		}
		double timeStep = .033 / subSteps;

		// **** Recalculate perlin noise values ****
		// (Do this outside the physics engine because this is expensive)

		double perlinScale = .2;
		for (int i = 0; i < particleSystem->_particleCount; i++)
		{
			Particle *p = particleSystem->_particles[i];
			p->perlinFactor = M_PI * 2 * PerlinNoise::PerlinNoise_3D(
				(p->position.X * perlinScale + currentTime * .1),
				p->position.Y * perlinScale,
				(p->position.Z * perlinScale + currentTime * .1));
		}

		// **** Run the physic calculation in small sub steps ****
		for (int i = 0; i < subSteps; i++)
		{
			// Pin the flag to the flagpole
			double fraction = (double)i / subSteps;
			FastVector realTop = Interpolate(lastTop, flagTop, fraction);
			FastVector realBottom = Interpolate(lastBottom, flagBottom, fraction);

			for (int j = 0; j < ypoints; j++)
			{
				particleSystem->SetParticlePostion(
					j * xpoints,
					Interpolate(realTop, realBottom, j / (ypoints - 1.0)));
			}

			// Perform the calculations for this substep
			ParticleSystem::Update_Midpoint(particleSystem, timeStep, currentTime);
			currentTime += timeStep;
		}

		
		// **** Render everything ****
		_graphics->Clear(' ');

		DrawLineSegments(flagBaseWorldPoints, '+', 13);
		DrawLineSegments(flagPoleWorldPoints, 'o', 8);
		DrawLineSegments((particleSystem->WorldPoints()), '*', 14);
		_graphics->DrawWidgets();

		sprintf(buffer,"Frame: %d", frame);
		_graphics->DrawString(buffer, _graphics->Width - 14, _graphics->Height - 3, 8);
		_graphics->DrawString("3D Graphics and physics engine rendered to text console.", 0, 0, 14);
		_graphics->DrawString("C++ source code available at http://www.ericjorgensen.com/plantedflag.html ", 0, 1, 14);
		_graphics->DrawString("Instructions: Use the mouse to move sliders and adjust settings. ", 1, 4, 7);
		_graphics->DrawString("              Click and drag the ball to move it. ", 1, 5, 7);
		_graphics->DrawString("              Click and drag away from the ball to rotate it. ", 1, 6, 7);

		_graphics->Refresh();
	
		lastTop = flagTop;
		lastBottom = flagBottom;
		frame++;
		Sleep(33);
	}
}