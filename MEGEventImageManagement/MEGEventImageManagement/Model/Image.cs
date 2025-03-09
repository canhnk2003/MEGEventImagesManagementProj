using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MEGEventImageManagement.Model
{
    public class Image
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        [Required]
        public DateTime TimeOccurs { get; set; }

        [MaxLength(500)]
        public string Path { get; set; }

        [Required]
        [ForeignKey("Event")]
        [Column(TypeName = "nvarchar(50)")]
        public string EventId { get; set; }

        // Navigation property
        public Event? Event { get; set; }
    }
}
