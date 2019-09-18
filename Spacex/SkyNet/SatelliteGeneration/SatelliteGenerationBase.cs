using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public abstract class SatelliteGenerationBase : BaseModel
    {
        public string Name { get; set; }
        protected List<SatelliteModel> _mainOrbit;

        public SatelliteGenerationBase(string name)
        {
            Name = name;
            _mainOrbit = CalculateOrbitSolutions();
        }

        public abstract SatelliteModel[] Generate(int count);

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// CalculateOrbitSolutions Precalculate satellite positions for a particular orbit
        /// </summary>
        //-------------------------------------------------------------------------------------
        private List<SatelliteModel> CalculateOrbitSolutions()
        {
            // Calculate the long orbit and divide it up into points. 
            double theta = 0;
            List<SatelliteModel> mainOrbit = new List<SatelliteModel>();
            var testSatellite = new SatelliteModel();
            var satelliteRadius = PhysicalConstants.EARTHRADIUS_METERS + SimulationConstants.Altitude_Meters;
            SetSatelliteData(theta, testSatellite, satelliteRadius);

            var stepDistanceMeters = 20000;
            mainOrbit.Add(testSatellite.Clone());
            var lastLocation = testSatellite.Location;
            var orbitCheckLocation = testSatellite.Location;
            int count = 0;
            var done = false;
            int thisOrbitCount = 0;
            while (!done)
            {
                while ((testSatellite.Location - lastLocation).Length < stepDistanceMeters)
                {
                    var length = (testSatellite.Location - lastLocation).Length;
                    count++;
                    testSatellite.Move(.1);

                    // Check for orbit completion
                    if (thisOrbitCount > 2)
                    {
                        if ((testSatellite.Location - orbitCheckLocation).Length < stepDistanceMeters)
                        {
                            theta += Math.PI * .05;
                            if (theta > Math.PI * 2)
                            {
                                done = true;
                            }
                            SetSatelliteData(theta, testSatellite, satelliteRadius);
                            orbitCheckLocation = lastLocation = testSatellite.Location;
                            thisOrbitCount = 0;
                            break;
                        }
                    }
                }
                mainOrbit.Add(testSatellite.Clone());
                thisOrbitCount++;
                lastLocation = testSatellite.Location;

            }
            return mainOrbit;
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// SetSatelliteData
        /// </summary>
        //-------------------------------------------------------------------------------------
        private void SetSatelliteData(double theta, SatelliteModel testSatellite, double satelliteRadius)
        {
            testSatellite.Location = new Vector3(
                (satelliteRadius) * Math.Sin(theta),
                0,
                (satelliteRadius) * Math.Cos(theta)
                );
            var stableVelocity = Math.Sqrt(PhysicalConstants.GM_EARTH / testSatellite.Location.Length);
            double prexv = stableVelocity * Math.Cos(SimulationConstants.Inclination);
            double yv = stableVelocity * Math.Sin(SimulationConstants.Inclination);
            double xv = prexv * Math.Cos(theta);
            double zv = -prexv * Math.Sin(theta);
            testSatellite.Velocity = new Vector3(xv, yv, zv);
        }
    }
}
