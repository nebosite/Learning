using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SkyNet
{
    public class SatelliteGeneratorRandom : SatelliteGenerationBase
    {
        public SatelliteGeneratorRandom() : base("Random")
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
            _label = "Random " + count;
            var rand = new Random();
            var satellites = new List<SatelliteModel>();
            for (int i = 0; i < count; i++)
            {
                var newSatellite = _mainOrbit[rand.Next(_mainOrbit.Count)];
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
