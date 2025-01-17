/*
  Blink

  Turns an LED on for one second, then off for one second, repeatedly.

  Most Arduinos have an on-board LED you can control. On the UNO, MEGA and ZERO
  it is attached to digital pin 13, on MKR1000 on pin 6. LED_BUILTIN is set to
  the correct LED pin independent of which board is used.
  If you want to know what pin the on-board LED is connected to on your Arduino
  model, check the Technical Specs of your board at:
  https://www.arduino.cc/en/Main/Products

  modified 8 May 2014
  by Scott Fitzgerald
  modified 2 Sep 2016
  by Arturo Guadalupi
  modified 8 Sep 2016
  by Colby Newman

  This example code is in the public domain.

  https://www.arduino.cc/en/Tutorial/BuiltInExamples/Blink
*/
#define DEBUG 1
#include "debugmacros.hpp"

// INPUT: Potentiometer should be connected to 5V and GND
int potPin = A3; // Potentiometer output connected to analog pin 3
int potVal = 0; // Variable to store the input from the potentiometer
int counter = 0;

// OUTPUT: Use digital pins 9-11, the Pulse-width Modulation (PWM) pins
// LED's cathodes should be connected to digital GND
int redPin = 9;   // Red LED,   connected to digital pin 9
int grnPin = 10;  // Green LED, connected to digital pin 10
int bluePin = 11;  // Blue LED,  connected to digital pin 11

// Program variables
int redVal = 0;   // Variables to store the values to send to the pins
int grnVal = 0;
int bluVal = 0;

// the setup function runs once when you press reset or power the board
void setup() {
  // initialize digital pin LED_BUILTIN as an output.
  // pinMode(LED_BUILTIN, OUTPUT);
  pinMode(redPin, OUTPUT);   // sets the pins as output
  pinMode(grnPin, OUTPUT);   
  pinMode(bluePin, OUTPUT); 
  Serial.begin(9600);
  // Serial.print("Hello there");
}

// the loop function runs over and over again forever
void loop() {
  counter++;
  potVal = analogRead(potPin) / 4;   // read the potentiometer value at the input pin
  DPRINT("---- Frame: ");
  DPRINTLN(counter);
  DPRINTLN(potVal);
  analogWrite(bluePin, potVal);
  delay(100);
}
