// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

// PlantedFlag.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include "PhysicsApp.h"


//------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------
int _tmain(int argc, _TCHAR* argv[])
{
	try{
		PhysicsApp app;
		app.Run();
	}
	catch (char *e)
	{
		printf("Exception: %s\n", e);
	}
	catch (...)
	{
		printf("Unknown exception was caught.\n");
	}

	printf("Press Enter...");
	getchar();
	return 0;
}

