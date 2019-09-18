// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#include "stdafx.h"
#include "PointerDictionary.h"


//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
PointerDictionary::PointerDictionary()
{
	_size = 200;
	_buckets = new PointerHolder*[_size];
	for (int i = 0; i < _size; i++) _buckets[i] = NULL;
}


//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
PointerDictionary::~PointerDictionary()
{
	for (int i = 0; i < _size; i++)
	{
		if (_buckets[i] != NULL) delete _buckets[i];
	}

	delete _buckets;
}

//------------------------------------------------------------------------
// Set - add/replace a key/value pair
//------------------------------------------------------------------------
void PointerDictionary::Set(void*key, void*value)
{
	PointerHolder *newHolder = new PointerHolder;
	newHolder->key = key;
	newHolder->value = value;
	newHolder->next = NULL;
	long int l;
	unsigned long slot = (unsigned long)((unsigned long long)key % _size);

	PointerHolder *bucket = _buckets[slot];
	if (!bucket) _buckets[slot] = newHolder;
	else
	{
		while (bucket)
		{
			if (bucket->key == key)
			{
				bucket->value = value;
				delete newHolder;
				return; // allow duplicate adds
			}
			if (!bucket->next)
			{
				bucket->next = newHolder;
				return;
			}
			bucket = bucket->next;
		}

	}

}

//------------------------------------------------------------------------
// Get a value - throw if the key is not there
//------------------------------------------------------------------------
void *PointerDictionary::Get(void* key)
{
	unsigned long slot = (unsigned long)((unsigned long long)key % _size);
	PointerHolder *bucket = _buckets[slot];

	while (bucket != NULL)
	{
		if (bucket->key == key)
		{
			return bucket->value;
		}
		bucket = bucket->next;
	}

	throw "Could not find pointer in dictionary";
}

//------------------------------------------------------------------------
// Has - return true if the key is in the dictionary
//------------------------------------------------------------------------
bool PointerDictionary::Has(void* key)
{
	unsigned long slot = (unsigned long)((unsigned long long)key % _size);
	PointerHolder *bucket = _buckets[slot];

	while (bucket != NULL)
	{
		if (bucket->key == key) return true;
		bucket = bucket->next;
	}

	return false;
}


