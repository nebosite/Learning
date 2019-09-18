// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#pragma once

//------------------------------------------------------------------------
// PointerHolder - key value pair for pointers
//------------------------------------------------------------------------
struct PointerHolder
{
	void *key;
	void *value;
	PointerHolder *next;
};

//------------------------------------------------------------------------
// PointerDictionary - map one pointer to another
//------------------------------------------------------------------------
class PointerDictionary
{
	PointerHolder **_buckets;
	int _size;
public:
	PointerDictionary();
	~PointerDictionary();

	void Set(void*, void*);
	void *Get(void*);
	bool Has(void*);
};

