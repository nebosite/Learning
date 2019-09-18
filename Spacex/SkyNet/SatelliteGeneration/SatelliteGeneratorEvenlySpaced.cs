using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public class SatelliteGeneratorEvenlySpaced : SatelliteGenerationBase
    {

        public SatelliteGeneratorEvenlySpaced():base("Evenly Spaced")
        {
        }

        string _label;

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// Generate 
        /// </summary>
        //-------------------------------------------------------------------------------------
        public override SatelliteModel[] Generate(int count)
        {
            _label = "Evenly Spaced " + count;
            var satellites = new List<SatelliteModel>();
            int skip = _mainOrbit.Count / count;
            for (int i = 0; i < count; i++)
            {
                var newSatellite = _mainOrbit[i * skip];
                newSatellite.Size = 5;
                satellites.Add(newSatellite.Clone());
            }

            return satellites.ToArray();
        }

        //-------------------------------------------------------------------------------------
        /// <summary>
        /// ToString 
        /// </summary>
        //-------------------------------------------------------------------------------------
        public override string ToString()
        {
            return _label;
        }
    }
}
